#!/usr/bin/env node
// @ts-check
// Saebom guard (D65): a PreToolUse hook shared by Claude Code and Antigravity CLI.
//
// It blocks what CLAUDE.md forbids outside a pull request: production and account
// commands, pushes to main, force-pushes, merges, secret files, edits to the
// guardrails themselves, agents started with their permission checks off, and
// Claude subagents below medium effort or on Fable (D64).
//
// Plain JavaScript on purpose: a Claude Code hook that fails to start lets the
// call through, so this file has to run on any Node version without a build step.
// It reads one hook payload on stdin and prints the decision on stdout.
//
// What it can't see: commands hidden in script files or interpreters
// (`bash x.sh`, `node -e`, `python -c`), and files a program opens without naming
// them on the command line. The deny rules in .claude/settings.json, the GitHub
// ruleset on main and the owner's review cover those.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = 'is an owner-only step (CLAUDE.md, Rules); ask the owner to run it';
const SECRET = 'holds secrets; agents never open, print or write it (CLAUDE.md, Rules)';
const GUARDRAIL =
  'is a guardrail the owner maintains (D65); describe the change you need in the PR instead';

// Redirect markers can't collide with a quoted ">" because of the NUL prefix.
const OUT = '\u0000>';
const IN = '\u0000<';

const SECRET_PATTERNS = [
  /(^|\/)\.env(\.[\w-]+)*$/, // .env, .env.local, .env.production.local (.env.example is allowed below)
  /(^|\/)\.env[^/]*[*?[]/, // a glob that can expand to an env file
  /\.(p8|p12|mobileprovision)$/i, // Apple signing and App Store Connect keys
  /(^|\/)\.supabase\/access-token$/,
  /(^|\/)\.config\/gh\/hosts\.yml$/,
  /(^|\/)\.gemini\/(oauth_creds|google_accounts)\.json$/,
  /(^|\/)\.claude\/\.credentials\.json$/,
  /(^|\/)\.ssh\/id_[^/]*$/,
  /(^|\/)\.netrc$/,
  /(^|\/)Library\/Keychains\//,
];

const GUARD_FILES = [
  'scripts/agents/guard.mjs',
  'scripts/agents/guard.test.mjs',
  'scripts/agents/guard-agy.sh',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.agents/hooks.json',
  '.gemini/config/hooks.json',
  '.gemini/antigravity-cli/settings.json',
];
const GUARD_DIRS = ['scripts/agents', '.claude', '.agents'];

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const WRAPPERS = new Set([
  'command',
  'builtin',
  'exec',
  'nohup',
  'time',
  'sudo',
  'doas',
  'nice',
  'caffeinate',
  '{',
  '}',
  '!',
  'if',
  'then',
  'else',
  'elif',
  'do',
  'while',
  'until',
]);
const WRITERS = new Set([
  'cp',
  'mv',
  'rm',
  'tee',
  'truncate',
  'ln',
  'chmod',
  'chown',
  'install',
  'rsync',
  'dd',
  'touch',
]);
const METADATA_ONLY = new Set(['ls', 'test', '[', 'stat']);

const SUPABASE_LOCAL_ONE = new Set([
  'start',
  'stop',
  'status',
  'init',
  'help',
  'services',
  'completion',
]);
const SUPABASE_LOCAL_TWO = new Set([
  'db reset',
  'db diff',
  'db lint',
  'db start',
  'migration new',
  'test db',
  'test new',
  'functions new',
  'functions serve',
]);
// Commands that work on the hosted project unless told otherwise.
const SUPABASE_NEEDS_LOCAL = new Set([
  'db dump',
  'gen types',
  'migration list',
  'migration up',
  'migration down',
  'migration repair',
  'migration squash',
  'migration fetch',
  'seed buckets',
  'inspect',
  'storage',
]);
const OWNER_NPM_SCRIPTS = new Set(['invite', 'build:ios', 'submit:ios']);

const RAW_PATTERNS = /** @type {const} */ ([
  [
    /\bsupabase\b[^\n]*\b(link|login|secrets|projects|orgs|bootstrap|branches|backups)\b/,
    'a Supabase account or production command',
  ],
  [
    /\bsupabase\b[^\n]*\b(db\s+(push|pull|dump)|functions\s+(deploy|delete|download)|config\s+push)\b/,
    'a Supabase production command',
  ],
  [/--linked\b|--db-url\b|--project-ref\b/, 'a command against the hosted Supabase project'],
  [
    /\bgit\b[^\n]*\bpush\b[^\n]*(\s-[A-Za-z]*f|--force|--mirror|\s\+|\bmain\b)/,
    'a force-push or a push to main',
  ],
  [/\bgh\s+pr\s+merge\b/, 'a pull request merge'],
  [/\b(eas|fastlane|altool|notarytool)\b/, 'an Expo or App Store command'],
  [/\bnpm\b[^\n]*\brun\s+(invite|build:ios|submit:ios)\b/, 'an owner-only npm script'],
  [
    /--no-verify\b|--dangerously-skip-permissions\b|bypassPermissions\b/,
    'a hook or permission bypass',
  ],
  [/\.env\.local\b|scripts\/\.env|\.p8\b|\.p12\b/, 'a secret file'],
]);

// ---------------------------------------------------------------- shell parsing

/**
 * Splits shell text into simple commands (arrays of unquoted words). The text of
 * $(...) and backtick substitutions comes back in `nested` so it can be checked
 * on its own. A heredoc or here-string marks the text opaque, and the caller
 * falls back to a plain-text scan, because stdin can be a script.
 * @param {string} src
 * @returns {{ commands: string[][], nested: string[], opaque: boolean }}
 */
export function parseShell(src) {
  /** @type {string[][]} */ const commands = [];
  /** @type {string[]} */ const nested = [];
  let opaque = false;
  /** @type {string[]} */ let current = [];
  let word = '';
  let inWord = false;

  const flush = () => {
    if (inWord) current.push(word);
    word = '';
    inWord = false;
  };
  const end = () => {
    flush();
    if (current.length > 0) commands.push(current);
    current = [];
  };

  /** @param {number} q index of the opening ' @returns {number} index of the closing ' */
  function skipSingle(q) {
    const e = src.indexOf("'", q + 1);
    return e === -1 ? src.length - 1 : e;
  }
  /** @param {number} q index of the opening " @returns {number} index of the closing " */
  function skipDouble(q) {
    for (let j = q + 1; j < src.length; j++) {
      const c = src[j];
      if (c === '\\') j++;
      else if (c === '$' && src[j + 1] === '(') j = matchParen(j + 1);
      else if (c === '`') j = matchBacktick(j);
      else if (c === '"') return j;
    }
    return src.length - 1;
  }
  /** @param {number} o index of a ( @returns {number} index of its matching ) */
  function matchParen(o) {
    let depth = 0;
    for (let j = o; j < src.length; j++) {
      const c = src[j];
      if (c === '\\') j++;
      else if (c === "'") j = skipSingle(j);
      else if (c === '"') j = skipDouble(j);
      else if (c === '(') depth++;
      else if (c === ')' && --depth === 0) return j;
    }
    return src.length - 1;
  }
  /** @param {number} b index of a ` @returns {number} index of the closing ` */
  function matchBacktick(b) {
    for (let j = b + 1; j < src.length; j++) {
      if (src[j] === '\\') j++;
      else if (src[j] === '`') return j;
    }
    return src.length - 1;
  }
  /** Records the substitution at s and returns the index of its last character. @param {number} s */
  function substitution(s) {
    if (src[s] === '`') {
      const e = matchBacktick(s);
      nested.push(src.slice(s + 1, e));
      return e;
    }
    const e = matchParen(s + 1);
    if (src[s + 2] !== '(') nested.push(src.slice(s + 2, e)); // $((...)) is arithmetic
    return e;
  }

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === ' ' || c === '\t' || c === '\r') {
      flush();
      i++;
    } else if (c === '\n' || c === ';') {
      end();
      i++;
    } else if (c === '&' && n === '>') {
      flush();
      current.push(OUT);
      i += src[i + 2] === '>' ? 3 : 2;
    } else if (c === '&' || c === '|') {
      end();
      i += n === c || (c === '|' && n === '&') ? 2 : 1;
    } else if (c === '(' || c === ')') {
      end();
      i++;
    } else if (c === '<' && n === '<') {
      opaque = true;
      flush();
      i += src[i + 2] === '<' ? 3 : 2;
    } else if (c === '>' || c === '<') {
      if (inWord && /^\d+$/.test(word)) {
        word = ''; // a file descriptor, as in 2>
        inWord = false;
      } else flush();
      current.push(c === '>' ? OUT : IN);
      i++;
      while (src[i] === '>' || src[i] === '&' || src[i] === '|') i++;
    } else if (c === "'") {
      const e = skipSingle(i);
      word += src.slice(i + 1, e);
      inWord = true;
      i = e + 1;
    } else if (c === '"') {
      const e = skipDouble(i);
      for (let j = i + 1; j < e; j++) {
        if (src[j] === '\\') j++;
        else if ((src[j] === '$' && src[j + 1] === '(') || src[j] === '`') j = substitution(j);
      }
      word += src.slice(i + 1, e).replace(/\\(["\\$`])/g, '$1');
      inWord = true;
      i = e + 1;
    } else if (c === '\\') {
      if (n !== '\n') word += n ?? '';
      inWord = n !== '\n' || inWord;
      i += 2;
    } else if ((c === '$' && n === '(') || c === '`') {
      const e = substitution(i);
      word += src.slice(i, e + 1);
      inWord = true;
      i = e + 1;
    } else {
      word += c;
      inWord = true;
      i++;
    }
  }
  end();
  return { commands, nested, opaque };
}

/**
 * Drops env assignments and wrappers (env, npx, npm exec, sudo…) to find the
 * program that actually runs.
 * @param {string[]} argv
 * @returns {{ prog: string, args: string[] } | null}
 */
export function unwrap(argv) {
  let k = 0;
  for (;;) {
    const w = argv[k];
    if (w === undefined) return null;
    const b = basename(w);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
      k++;
    } else if (WRAPPERS.has(b)) {
      k++;
      while (argv[k]?.startsWith('-')) k++;
    } else if (b === 'env') {
      k++;
      for (
        let next = argv[k];
        next !== undefined && (next.startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(next));
        next = argv[k]
      ) {
        if (next === '-u' || next === '-C' || next === '-S') k++;
        k++;
      }
      if (argv[k] === undefined) return { prog: 'env', args: [] };
    } else if (b === 'timeout') {
      k++;
      while (argv[k]?.startsWith('-')) k++;
      k++;
    } else if (b === 'npx' || b === 'bunx' || b === 'pnpx') {
      k++;
      while (argv[k]?.startsWith('-')) {
        if (argv[k] === '-c' || argv[k] === '--call')
          return { prog: 'sh', args: ['-c', argv[k + 1] ?? ''] };
        if (argv[k] === '-p' || argv[k] === '--package') k++;
        k++;
      }
    } else if (
      (b === 'pnpm' || b === 'yarn' || b === 'bun') &&
      ['dlx', 'exec', 'x'].includes(argv[k + 1] ?? '')
    ) {
      k += 2;
      while (argv[k]?.startsWith('-')) k++;
    } else if (b === 'npm' && (argv[k + 1] === 'exec' || argv[k + 1] === 'x')) {
      k += 2;
      while (argv[k]?.startsWith('-')) {
        const flag = argv[k];
        k++;
        if (flag === '--') break;
        if (flag === '-p' || flag === '--package') k++;
      }
    } else {
      return { prog: b, args: argv.slice(k + 1) };
    }
  }
}

// ---------------------------------------------------------------- paths

/** @param {unknown} raw */
export function isSecretPath(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return false;
  const p = raw.replace(/\\/g, '/').replace(/^file:\/\//, '');
  if (/(^|\/)\.env\.example$/.test(p)) return false;
  return SECRET_PATTERNS.some((r) => r.test(p));
}

/** @param {unknown} raw */
export function isGuardFile(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  const p = raw
    .replace(/\\/g, '/')
    .replace(/^file:\/\//, '')
    .replace(/^\.\//, '');
  if (GUARD_FILES.some((g) => p === g || p.endsWith(`/${g}`))) return true;
  // A glob such as scripts/agents/* or .claude/*.json can reach a guard file.
  return (
    /[*?[]/.test(p) &&
    GUARD_DIRS.some((d) => p === d || p.startsWith(`${d}/`) || p.includes(`/${d}/`))
  );
}

/** @param {string} kind @param {unknown} path @returns {string | null} */
function checkPath(kind, path) {
  if (typeof path !== 'string' || path.length === 0) return null;
  if (isSecretPath(path)) return `${path} ${SECRET}`;
  if (kind === 'write' && isGuardFile(path)) return `${path} ${GUARDRAIL}`;
  return null;
}

// ---------------------------------------------------------------- commands

/**
 * @param {string} text
 * @param {{ cwd?: string, raw: string }} ctx
 * @param {number} [depth]
 * @returns {string | null}
 */
function checkShell(text, ctx, depth = 0) {
  if (depth > 4) return 'the command nests shells too deeply for the guard to check';
  const parsed = parseShell(text);
  if (parsed.opaque) {
    const hit = rawScan(text);
    if (hit) return hit;
  }
  for (const words of parsed.commands) {
    const reason = checkSimple(words, ctx, depth);
    if (reason) return reason;
  }
  for (const inner of parsed.nested) {
    const reason = checkShell(inner, ctx, depth + 1);
    if (reason) return reason;
  }
  return null;
}

/** @param {string} text @returns {string | null} */
function rawScan(text) {
  for (const [pattern, what] of RAW_PATTERNS) {
    if (pattern.test(text)) {
      return `this command feeds a shell from stdin and contains ${what}; run commands directly so the guard can check them`;
    }
  }
  return null;
}

/**
 * @param {string[]} words
 * @param {{ cwd?: string, raw: string }} ctx
 * @param {number} depth
 * @returns {string | null}
 */
function checkSimple(words, ctx, depth) {
  /** @type {string[]} */ const argv = [];
  for (let k = 0; k < words.length; k++) {
    const w = words[k] ?? '';
    if (w === OUT || w === IN) {
      const target = words[k + 1] ?? '';
      k++;
      if (isSecretPath(target)) return `${target} ${SECRET}`;
      if (w === OUT && isGuardFile(target)) return `${target} ${GUARDRAIL}`;
    } else {
      argv.push(w);
    }
  }

  const cmd = unwrap(argv);
  if (!cmd) return null;
  const { prog, args } = cmd;

  if (SHELLS.has(prog)) {
    const c = args.findIndex((a) => /^-[A-Za-z]*c[A-Za-z]*$/.test(a));
    if (c !== -1) return checkShell(args[c + 1] ?? '', ctx, depth + 1);
    if (args.every((a) => a.startsWith('-'))) return rawScan(ctx.raw); // reads a script from stdin
    return null; // a script file: the guard can't see inside (see the header)
  }
  if (prog === 'eval') return checkShell(args.join(' '), ctx, depth + 1);
  if (prog === 'xargs') {
    let k = 0;
    while (args[k]?.startsWith('-')) {
      if (/^-[IinLPdEs]$/.test(args[k] ?? '')) k++;
      k++;
    }
    return checkSimple(args.slice(k), ctx, depth + 1);
  }
  if (prog === 'find') {
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-exec' || args[k] === '-execdir' || args[k] === '-ok') {
        let e = k + 1;
        while (e < args.length && args[e] !== ';' && args[e] !== '+') e++;
        const reason = checkSimple(args.slice(k + 1, e), ctx, depth + 1);
        if (reason) return reason;
        k = e;
      }
    }
  }

  for (let k = 0; k < args.length; k++) {
    const a = args[k] ?? '';
    if (
      a === '--dangerously-skip-permissions' ||
      a === '--dangerously-bypass-approvals-and-sandbox' ||
      a === '--permission-mode=bypassPermissions' ||
      (a === '--permission-mode' && args[k + 1] === 'bypassPermissions')
    ) {
      return `${prog} ${a} starts an agent with its permission checks off, which also skips this guard (D65)`;
    }
    if (/^--(linked|db-url|project-ref)(=|$)/.test(a)) {
      return `${a.split('=')[0]} points at the hosted Supabase project, which ${OWNER}`;
    }
    if (a === '--no-verify')
      return `${prog} --no-verify skips the hooks (CLAUDE.md: never bypass a hook)`;
  }

  const ruled = checkProgram(prog, args, ctx);
  if (ruled) return ruled;

  for (const w of wordsToScan(prog, args)) {
    for (const part of [w, ...w.split('=').slice(1)]) {
      if (isSecretPath(part)) return `${part} ${SECRET}`;
    }
  }

  if (writesGuardFile(prog, args)) return `this command changes a file that ${GUARDRAIL}`;
  return null;
}

/**
 * Words that could name a file. Commit messages, PR text and echo output are
 * data, not paths, so they're left out to avoid false alarms.
 * @param {string} prog
 * @param {string[]} args
 * @returns {string[]}
 */
function wordsToScan(prog, args) {
  if (prog === 'echo' || prog === 'printf') return [];
  if (METADATA_ONLY.has(prog)) return [];
  if (prog === 'git' && ['check-ignore', 'status'].includes(firstWord(args))) return [];
  let words = args;
  if (prog === 'supabase') {
    // The one sanctioned use of a secret file: functions serve reads it itself.
    words = args.filter(
      (a, k) =>
        !(args[k - 1] === '--env-file' && /(^|\/)supabase\/functions\/\.env\.local$/.test(a)),
    );
    words = words.filter((a) => !/^--env-file=(\.\/)?supabase\/functions\/\.env\.local$/.test(a));
  }
  if (prog === 'git' || prog === 'gh') {
    /** @type {string[]} */ const kept = [];
    for (let k = 0; k < words.length; k++) {
      const a = words[k] ?? '';
      if (/^--(message|title|body|notes)=/.test(a)) continue;
      kept.push(a);
      if (['-m', '--message', '--title', '-t', '--body', '-b', '--notes'].includes(a)) k++;
      else if (prog === 'git' && /^-[A-Za-z]*m$/.test(a)) k++; // -am "message"
    }
    words = kept;
  }
  return words;
}

/** @param {string} prog @param {string[]} args */
function writesGuardFile(prog, args) {
  if (WRITERS.has(prog)) return args.some(isGuardFile);
  if (
    (prog === 'sed' || prog === 'perl' || prog === 'ruby') &&
    args.some((a) => /^-[A-Za-z]*i/.test(a) || a.startsWith('--in-place'))
  ) {
    return args.some(isGuardFile);
  }
  if (prog === 'git' && ['rm', 'mv', 'checkout', 'restore'].includes(firstWord(args)))
    return args.some(isGuardFile);
  return false;
}

/** @param {string[]} args */
function firstWord(args) {
  return args.find((a) => !a.startsWith('-')) ?? '';
}

/**
 * @param {string} prog
 * @param {string[]} args
 * @param {{ cwd?: string }} ctx
 * @returns {string | null}
 */
function checkProgram(prog, args, ctx) {
  switch (prog) {
    case 'supabase':
      return checkSupabase(args);
    case 'npm':
      return checkNpm(args);
    case 'git':
      return checkGit(args, ctx.cwd);
    case 'gh':
      return checkGh(args);
    case 'eas':
    case 'eas-cli':
      return `eas ${args[0] ?? ''} uses the owner's Expo account (builds, submits, updates) and ${OWNER}`;
    case 'fastlane':
    case 'altool':
    case 'iTMSTransporter':
      return `${prog} uploads to App Store Connect and ${OWNER}`;
    case 'xcrun':
      return ['altool', 'notarytool'].includes(args[0] ?? '')
        ? `xcrun ${args[0]} uploads to Apple and ${OWNER}`
        : null;
    case 'xcodebuild':
      return args.includes('-exportArchive')
        ? `xcodebuild -exportArchive prepares an App Store upload and ${OWNER}`
        : null;
    case 'security':
      return /^(find-generic-password|find-internet-password|dump-keychain|export|find-certificate)$/.test(
        args[0] ?? '',
      )
        ? `security ${args[0]} reads the keychain, which holds credentials`
        : null;
    case 'printenv':
      return args.length === 0 || args.some((a) => /KEY|TOKEN|SECRET|PASSWORD/i.test(a))
        ? 'printing the environment can expose credentials'
        : null;
    case 'env':
      return args.length === 0 ? 'printing the environment can expose credentials' : null;
    default:
      return null;
  }
}

/** @param {string[]} args @returns {string | null} */
function checkSupabase(args) {
  const words = args.filter((a) => !a.startsWith('-'));
  if (words.length === 0) return null; // --version, --help
  const one = words[0] ?? '';
  const two = `${one} ${words[1] ?? ''}`.trim();
  if (SUPABASE_LOCAL_ONE.has(one) || SUPABASE_LOCAL_TWO.has(two)) return null;
  if (SUPABASE_NEEDS_LOCAL.has(two) || SUPABASE_NEEDS_LOCAL.has(one)) {
    return args.includes('--local')
      ? null
      : `supabase ${two} works on the hosted project unless you pass --local; agents use only the local stack (CLAUDE.md)`;
  }
  return `supabase ${two} reaches the Supabase account or the hosted project and ${OWNER}`;
}

/** @param {string[]} args @returns {string | null} */
function checkNpm(args) {
  /** @type {string[]} */ const rest = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k] ?? '';
    if (['--prefix', '-C', '-w', '--workspace'].includes(a)) k++;
    else if (!a.startsWith('--prefix=') && !a.startsWith('--workspace=')) rest.push(a);
  }
  if (!['run', 'run-script', 'rum', 'urn'].includes(rest[0] ?? '')) return null;
  const script = rest.slice(1).find((a) => !a.startsWith('-'));
  return script && OWNER_NPM_SCRIPTS.has(script) ? `npm run ${script} ${OWNER}` : null;
}

/**
 * True when a short-flag cluster such as -anm contains `flag` before any flag
 * that takes the rest of the cluster as its value.
 * @param {string} cluster @param {string} flag @param {string} takesValue
 */
function clusterHas(cluster, flag, takesValue) {
  if (!/^-[A-Za-z]+$/.test(cluster)) return false;
  for (const c of cluster.slice(1)) {
    if (c === flag) return true;
    if (takesValue.includes(c)) return false;
  }
  return false;
}

/** @param {string[]} args @param {string | undefined} cwd @returns {string | null} */
function checkGit(args, cwd) {
  let k = 0;
  let dir = cwd;
  while (k < args.length && (args[k] ?? '').startsWith('-')) {
    const a = args[k] ?? '';
    if (a === '-c') {
      if (/^core\.hookspath=/i.test(args[k + 1] ?? ''))
        return 'git -c core.hooksPath bypasses the repo hooks';
      k += 2;
    } else if (a === '-C') {
      dir = resolve(dir ?? '.', args[k + 1] ?? '.');
      k += 2;
    } else if (a === '--git-dir' || a === '--work-tree' || a === '--namespace') {
      k += 2;
    } else {
      k++;
    }
  }
  const sub = args[k] ?? '';
  const rest = args.slice(k + 1);
  switch (sub) {
    case 'push':
      return checkPush(rest, dir);
    case 'commit':
      return rest.some((a) => clusterHas(a, 'n', 'mFCct'))
        ? 'git commit -n skips the hooks (CLAUDE.md: never bypass a hook)'
        : null;
    case 'add':
      return rest.some((a) => a === '--force' || clusterHas(a, 'f', ''))
        ? 'git add --force stages ignored files, such as .env.local'
        : null;
    case 'config':
      return rest.some((a) => /^core\.hookspath$/i.test(a))
        ? 'changing core.hooksPath bypasses the repo hooks'
        : null;
    default:
      return null;
  }
}

/** @param {string | undefined} dir @returns {string | null} */
function currentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir ?? '.', 'branch', '--show-current'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** @param {string[]} rest @param {string | undefined} dir @returns {string | null} */
function checkPush(rest, dir) {
  const force = 'rewrites remote history (CLAUDE.md: never force-push)';
  /** @type {string[]} */ const positional = [];
  for (let k = 0; k < rest.length; k++) {
    const a = rest[k] ?? '';
    if (a === '--') {
      positional.push(...rest.slice(k + 1));
      break;
    }
    if (a.startsWith('--')) {
      if (/^--(force|force-with-lease|force-if-includes|mirror|all|prune)(=|$)/.test(a)) {
        return `git push ${a.split('=')[0]} ${force}`;
      }
      if (['--repo', '--receive-pack', '--exec', '--push-option'].includes(a)) k++;
    } else if (a.startsWith('-') && a.length > 1) {
      if (clusterHas(a, 'f', 'o')) return `git push ${a} ${force}`;
      if (a === '-o') k++;
    } else {
      positional.push(a);
    }
  }
  const toMain = "pushes to main; only the owner's merge updates main (CLAUDE.md)";
  const [remote, ...refspecs] = positional;
  if (remote === 'main') return `git push main ${toMain}`;
  for (const spec of refspecs) {
    if (spec.startsWith('+')) return `git push ${spec} ${force}`;
    const target = (spec.includes(':') ? spec.slice(spec.lastIndexOf(':') + 1) : spec).replace(
      /^refs\/heads\//,
      '',
    );
    if (target === 'main') return `git push ${remote} ${spec} ${toMain}`;
    if (target === 'HEAD' || target === '@') {
      const branch = currentBranch(dir);
      if (branch === null)
        return 'the guard could not tell which branch this pushes; push a named branch (git push -u origin <branch>)';
      if (branch === 'main') return `git push ${remote} ${spec} ${toMain}`;
    }
  }
  if (refspecs.length === 0) {
    const branch = currentBranch(dir);
    if (branch === null)
      return 'the guard could not tell which branch this pushes; push a named branch (git push -u origin <branch>)';
    if (branch === 'main' || branch === '')
      return `git push from ${branch || 'a detached HEAD'} ${toMain}`;
  }
  return null;
}

/** @param {string[]} args @returns {string | null} */
function checkGh(args) {
  let k = 0;
  while ((args[k] ?? '').startsWith('-')) {
    if (args[k] === '-R' || args[k] === '--repo') k++;
    k++;
  }
  const group = args[k] ?? '';
  const action = args[k + 1] ?? '';
  const rest = args.slice(k + 2);
  if (group === 'pr' && action === 'merge')
    return 'gh pr merge: the owner merges every pull request (D58)';
  if (group === 'pr' && action === 'review' && rest.some((a) => a === '--approve' || a === '-a')) {
    return 'agents never approve pull requests; the owner reviews them (D58)';
  }
  if (
    group === 'repo' &&
    ['delete', 'edit', 'rename', 'archive', 'unarchive', 'deploy-key'].includes(action)
  ) {
    return `gh repo ${action} changes repository settings and ${OWNER}`;
  }
  if (group === 'secret' || group === 'variable')
    return `gh ${group} manages GitHub Actions ${group}s and ${OWNER}`;
  if (group === 'workflow' && ['run', 'enable', 'disable'].includes(action)) {
    return `gh workflow ${action} can start deploys or backups against production and ${OWNER}`;
  }
  if (group === 'release' && ['create', 'delete', 'upload', 'edit'].includes(action))
    return `gh release ${action} ${OWNER}`;
  if (
    group === 'auth' &&
    (action === 'token' || rest.includes('--show-token') || rest.includes('-t'))
  ) {
    return 'gh auth token prints a credential';
  }
  if (group === 'api') return checkGhApi(args.slice(k + 1));
  return null;
}

/** @param {string[]} rest @returns {string | null} */
function checkGhApi(rest) {
  let method = '';
  let fields = false;
  let endpoint = '';
  for (let k = 0; k < rest.length; k++) {
    const a = rest[k] ?? '';
    if (a === '-X' || a === '--method') {
      method = (rest[k + 1] ?? '').toUpperCase();
      k++;
    } else if (a.startsWith('--method=')) {
      method = a.slice('--method='.length).toUpperCase();
    } else if (/^-X[A-Za-z]+$/.test(a)) {
      method = a.slice(2).toUpperCase();
    } else if (['-f', '-F', '--field', '--raw-field', '--input'].includes(a)) {
      fields = true;
      k++;
    } else if (a.startsWith('-')) {
      if (
        [
          '-H',
          '--header',
          '-q',
          '--jq',
          '-t',
          '--template',
          '--cache',
          '-p',
          '--preview',
          '--hostname',
        ].includes(a)
      )
        k++;
    } else if (!endpoint) {
      endpoint = a;
    }
  }
  const effective = method || (fields ? 'POST' : 'GET'); // gh api sends POST once fields are added
  if (effective === 'GET' || effective === 'HEAD') return null;
  return `gh api ${effective} ${endpoint} changes GitHub state; use gh pr or gh issue commands for comments, and leave settings and merges to the owner`;
}

// ---------------------------------------------------------------- agents

/** @param {Record<string, unknown>} input @returns {string | null} */
function checkAgent(input) {
  if (input.effort === 'low')
    return 'subagents run at medium effort or higher (D64); use medium, high or xhigh';
  if (typeof input.model === 'string' && /fable/i.test(input.model)) {
    return 'Fable bills to usage credits on Claude Pro, and the project allows no extra spend (D64); use opus or sonnet';
  }
  return null;
}

// ---------------------------------------------------------------- payloads

/** @param {unknown} value @returns {string[]} */
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** @param {Record<string, any>} p @returns {string | null} */
function decideClaude(p) {
  const tool = String(p.tool_name ?? '');
  const input = p.tool_input && typeof p.tool_input === 'object' ? p.tool_input : {};
  switch (tool) {
    case 'Bash': {
      const command = String(input.command ?? '');
      return checkShell(command, {
        cwd: typeof p.cwd === 'string' ? p.cwd : undefined,
        raw: command,
      });
    }
    case 'Read':
      return checkPath('read', input.file_path);
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      return checkPath('write', input.file_path);
    case 'NotebookEdit':
      return checkPath('write', input.notebook_path);
    case 'Agent':
    case 'Task':
      return checkAgent(input);
    default:
      if (/pull_?request.*merge|merge.*pull_?request|merge_pr\b/i.test(tool)) {
        return `${tool} merges a pull request; the owner merges every pull request (D58)`;
      }
      for (const value of strings(input)) if (isSecretPath(value)) return `${value} ${SECRET}`;
      return null;
  }
}

/** @param {Record<string, any>} p @returns {string | null} */
function decideAntigravity(p) {
  const call = p.toolCall && typeof p.toolCall === 'object' ? p.toolCall : {};
  const name = String(call.name ?? '');
  const args = call.args && typeof call.args === 'object' ? call.args : {};
  const workspace =
    Array.isArray(p.workspacePaths) && typeof p.workspacePaths[0] === 'string'
      ? p.workspacePaths[0]
      : undefined;
  const cwd = (typeof args.Cwd === 'string' ? args.Cwd : workspace)?.replace(/^file:\/\//, '');
  switch (name) {
    case 'run_command': {
      const command = String(args.CommandLine ?? '');
      return checkShell(command, { cwd, raw: command });
    }
    case 'view_file':
      return checkPath('read', args.AbsolutePath);
    case 'write_to_file':
    case 'replace_file_content':
    case 'multi_replace_file_content':
      return checkPath('write', args.TargetFile);
    default:
      for (const value of strings(args)) if (isSecretPath(value)) return `${value} ${SECRET}`;
      return null;
  }
}

/**
 * @param {unknown} payload
 * @returns {{ format: 'claude' | 'antigravity' | 'unknown', reason: string | null }}
 */
export function decide(payload) {
  if (payload && typeof payload === 'object') {
    const p = /** @type {Record<string, any>} */ (payload);
    if ('toolCall' in p) return { format: 'antigravity', reason: decideAntigravity(p) };
    if ('tool_name' in p) return { format: 'claude', reason: decideClaude(p) };
  }
  return {
    format: 'unknown',
    reason: 'the guard did not recognize the hook input, so it blocks the call',
  };
}

/**
 * Prints the decision in the shape each tool reads. Claude Code: no output
 * allows the call; a deny goes in hookSpecificOutput. Antigravity: "allow"
 * hands the call to its normal permission checks.
 * @param {'claude' | 'antigravity' | 'unknown'} format
 * @param {string | null} reason
 */
export function render(format, reason) {
  const message = reason ? `Saebom guard: ${reason}.` : '';
  const claude = {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: message,
  };
  if (format === 'claude') return reason ? JSON.stringify({ hookSpecificOutput: claude }) : '';
  if (format === 'antigravity')
    return JSON.stringify(reason ? { decision: 'deny', reason: message } : { decision: 'allow' });
  return JSON.stringify({ decision: 'deny', reason: message, hookSpecificOutput: claude });
}

function main() {
  let text = '';
  try {
    text = readFileSync(0, 'utf8');
  } catch {
    text = '';
  }
  /** @type {{ format: 'claude' | 'antigravity' | 'unknown', reason: string | null }} */
  let result;
  try {
    result = decide(JSON.parse(text));
  } catch (error) {
    const format = text.includes('"toolCall"')
      ? 'antigravity'
      : text.includes('"tool_name"')
        ? 'claude'
        : 'unknown';
    const detail = error instanceof Error ? error.message : String(error);
    result = { format, reason: `the guard failed (${detail}), so it blocks the call` };
  }
  const out = render(result.format, result.reason);
  if (out) process.stdout.write(`${out}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
