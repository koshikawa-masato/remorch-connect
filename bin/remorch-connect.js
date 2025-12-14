#!/usr/bin/env node

const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function log(msg) {
  console.log(msg);
}

function logHeader(msg) {
  console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}${msg}${colors.reset}`);
}

function logDim(msg) {
  console.log(`${colors.dim}${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`${colors.red}${msg}${colors.reset}`);
}

// Get network interfaces
function getIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    for (const net of nets) {
      if (net.internal || net.family !== 'IPv4') continue;
      addresses.push({
        interface: name,
        address: net.address,
        isTailscale: name.toLowerCase().includes('tailscale') ||
                     name.toLowerCase().includes('utun') ||
                     net.address.startsWith('100.'),
      });
    }
  }
  return addresses;
}

// Try to get Tailscale IP
function getTailscaleIP() {
  try {
    const result = execSync('tailscale ip -4 2>/dev/null', { encoding: 'utf8' });
    return result.trim();
  } catch {
    return null;
  }
}

// Check if tmux is running
function getTmuxSessions() {
  try {
    const result = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// Check if session exists
function sessionExists(name) {
  try {
    execSync(`tmux has-session -t "${name}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

// Create tmux session and run command
function createSessionWithCommand(sessionName, command) {
  try {
    if (sessionExists(sessionName)) {
      log(`${colors.yellow}Session "${sessionName}" already exists${colors.reset}`);
      return { created: false, existed: true };
    }

    // Create detached session
    execSync(`tmux new-session -d -s "${sessionName}"`, { encoding: 'utf8' });

    // Send command
    execSync(`tmux send-keys -t "${sessionName}" "${command}" Enter`, { encoding: 'utf8' });

    return { created: true, existed: false };
  } catch (err) {
    logError(`Failed to create session: ${err.message}`);
    return { created: false, existed: false, error: err.message };
  }
}

// Attach to session
function attachToSession(sessionName) {
  const tmux = spawn('tmux', ['attach', '-t', sessionName], {
    stdio: 'inherit',
  });

  tmux.on('close', (code) => {
    log('');
    logDim(`Detached from session "${sessionName}"`);
    logDim('Session continues running in background.');
    logDim(`Reattach with: tmux attach -t ${sessionName}`);
  });
}

// Generate short code
function generateShortCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{4}/g).join('-');
}

// Generate QR code image and open it
async function generateQRImage(data, sessionName) {
  const tmpDir = os.tmpdir();
  const filename = sessionName ? `remorch-qr-${sessionName}.png` : 'remorch-qr.png';
  const filepath = path.join(tmpDir, filename);

  try {
    await QRCode.toFile(filepath, data, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    // Open with default viewer
    const platform = os.platform();
    if (platform === 'darwin') {
      execSync(`open "${filepath}"`, { stdio: 'ignore' });
    } else if (platform === 'linux') {
      // Try xdg-open for Linux
      try {
        execSync(`xdg-open "${filepath}"`, { stdio: 'ignore' });
      } catch {
        // Fallback: just show path
        return filepath;
      }
    } else if (platform === 'win32') {
      execSync(`start "" "${filepath}"`, { stdio: 'ignore' });
    }

    return filepath;
  } catch (err) {
    logError(`Failed to generate QR image: ${err.message}`);
    return null;
  }
}

// Show connection info and QR code
async function showConnectionInfo(sessionName = null) {
  const username = os.userInfo().username;
  const hostname = os.hostname();
  const port = 22;

  const addresses = getIPAddresses();
  const tailscaleIP = getTailscaleIP();

  let primaryIP = tailscaleIP;
  if (!primaryIP && addresses.length > 0) {
    const tailscaleAddr = addresses.find(a => a.isTailscale);
    primaryIP = tailscaleAddr ? tailscaleAddr.address : addresses[0].address;
  }

  if (!primaryIP) {
    logError('Error: No network interface found');
    process.exit(1);
  }

  const sessions = getTmuxSessions();

  const connectionInfo = {
    v: 1,
    h: primaryIP,
    p: port,
    u: username,
    s: sessionName, // Include session name if provided
    t: Date.now(),
  };

  const jsonStr = JSON.stringify(connectionInfo);
  const encoded = Buffer.from(jsonStr).toString('base64');
  const shortCode = generateShortCode();

  // Custom URL scheme for RemOrch app
  const remOrchUrl = `remorch://${encoded}`;

  // Display
  log(`${colors.bright}Connection Info:${colors.reset}`);
  log(`  Host:     ${colors.cyan}${primaryIP}${colors.reset}`);
  log(`  Port:     ${port}`);
  log(`  User:     ${username}`);
  if (sessionName) {
    log(`  Session:  ${colors.green}${sessionName}${colors.reset}`);
  }
  console.log('');

  if (tailscaleIP) {
    logSuccess(`  ✓ Tailscale detected: ${tailscaleIP}`);
  }

  if (sessions.length > 0) {
    logSuccess(`  ✓ tmux sessions: ${sessions.join(', ')}`);
  }
  console.log('');

  // QR Code - Generate image and open
  logHeader('Scan with RemOrch app:');
  console.log('');

  // Web URL for environments without GUI
  // TODO: Change to https://remorch.dev/ once domain is verified
  const webUrl = `https://koshikawa-masato.github.io/remorch-web/#${encoded}`;

  const qrPath = await generateQRImage(remOrchUrl, sessionName);
  if (qrPath) {
    logSuccess(`  ✓ QR code opened: ${qrPath}`);
  } else {
    // Fallback to terminal QR
    qrcodeTerminal.generate(remOrchUrl, { small: true }, (qr) => {
      console.log(qr);
    });
  }

  console.log('');
  log(`Or enter code: ${colors.bright}${colors.cyan}${shortCode}${colors.reset}`);
  console.log('');

  // Always show web URL (useful for headless environments)
  logDim('Or open on your phone:');
  log(`  ${colors.cyan}${webUrl}${colors.reset}`);
  console.log('');

  logDim('─────────────────────────────────────────');
  logDim('Manual connection:');
  logDim(`  ssh ${username}@${primaryIP}`);
  if (sessionName) {
    logDim(`  tmux attach -t ${sessionName}`);
  }
  logDim('─────────────────────────────────────────');
  console.log('');

  return { primaryIP, username, sessions };
}

// Detect shell environment
function detectShellEnv() {
  const platform = os.platform();
  const shell = process.env.SHELL || '';
  const home = os.homedir();

  let env = {
    platform,
    shell: 'unknown',
    configFile: null,
    isWSL: false,
  };

  // Check WSL
  if (platform === 'linux') {
    try {
      const release = execSync('uname -r 2>/dev/null', { encoding: 'utf8' });
      env.isWSL = release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
    } catch {}
  }

  // Detect shell and config file
  if (shell.includes('zsh')) {
    env.shell = 'zsh';
    env.configFile = `${home}/.zshrc`;
  } else if (shell.includes('bash')) {
    env.shell = 'bash';
    if (platform === 'darwin') {
      env.configFile = `${home}/.bash_profile`;
    } else {
      env.configFile = `${home}/.bashrc`;
    }
  } else if (shell.includes('fish')) {
    env.shell = 'fish';
    env.configFile = `${home}/.config/fish/config.fish`;
  }

  // Platform name
  if (platform === 'darwin') {
    env.platformName = 'macOS';
  } else if (env.isWSL) {
    env.platformName = 'WSL';
  } else if (platform === 'linux') {
    env.platformName = 'Linux';
  } else {
    env.platformName = platform;
  }

  return env;
}

// Setup aliases
function setupAliases() {
  const fs = require('fs');
  const env = detectShellEnv();

  console.log('');
  logHeader('RemOrch Connect - Shell Setup');
  console.log('');

  log(`Detected: ${colors.cyan}${env.platformName}${colors.reset} (${env.shell})`);

  if (!env.configFile) {
    logError('Could not detect shell configuration file.');
    log('');
    log('Please manually add these lines to your shell config:');
    log('');
    showAliasSnippet(env.shell);
    return;
  }

  log(`Config:   ${colors.dim}${env.configFile}${colors.reset}`);
  console.log('');

  // Check if already configured
  let existingConfig = '';
  try {
    existingConfig = fs.readFileSync(env.configFile, 'utf8');
  } catch {}

  if (existingConfig.includes('remorch-connect')) {
    log(`${colors.yellow}! RemOrch aliases already exist in ${env.configFile}${colors.reset}`);
    log('');
    log('Current aliases:');
    showAliasSnippet(env.shell);
    return;
  }

  // Generate alias block
  const aliasBlock = generateAliasBlock(env.shell);

  // Append to config
  try {
    fs.appendFileSync(env.configFile, '\n' + aliasBlock);
    logSuccess(`✓ Added aliases to ${env.configFile}`);
    console.log('');
    log('Added:');
    showAliasSnippet(env.shell);
    console.log('');
    logHeader('To activate now, run:');
    log(`  source ${env.configFile}`);
    console.log('');
    logDim('Or restart your terminal.');
  } catch (err) {
    logError(`Failed to write to ${env.configFile}: ${err.message}`);
    log('');
    log('Please manually add these lines:');
    log('');
    showAliasSnippet(env.shell);
  }
}

// Generate alias block for config file
function generateAliasBlock(shell) {
  const timestamp = new Date().toISOString().split('T')[0];

  if (shell === 'fish') {
    return `
# RemOrch Connect aliases (added ${timestamp})
function claude; npx remorch-connect claude $argv; end
function gemini; npx remorch-connect gemini $argv; end
function codex; npx remorch-connect codex $argv; end
function remorch; npx remorch-connect $argv; end
`;
  }

  // bash/zsh
  return `
# RemOrch Connect aliases (added ${timestamp})
alias claude='npx remorch-connect claude'
alias gemini='npx remorch-connect gemini'
alias codex='npx remorch-connect codex'
alias remorch='npx remorch-connect'
`;
}

// Show alias snippet
function showAliasSnippet(shell) {
  if (shell === 'fish') {
    logDim('  function claude; npx remorch-connect claude $argv; end');
    logDim('  function gemini; npx remorch-connect gemini $argv; end');
    logDim('  function codex; npx remorch-connect codex $argv; end');
  } else {
    logDim("  alias claude='npx remorch-connect claude'");
    logDim("  alias gemini='npx remorch-connect gemini'");
    logDim("  alias codex='npx remorch-connect codex'");
  }
}

// Show help
function showHelp() {
  console.log('');
  logHeader('RemOrch Connect - AI CLI Remote Access');
  console.log('');
  log('Usage:');
  log('  remorch-connect              Show connection info');
  log('  remorch-connect <command>    Start CLI in tmux + show info');
  console.log('');
  log('Examples:');
  log('  remorch-connect claude       Start Claude Code');
  log('  remorch-connect gemini       Start Gemini CLI');
  log('  remorch-connect "claude --help"  With arguments');
  console.log('');
  log('Options:');
  log('  --setup        Add shell aliases (claude, gemini, codex)');
  log('  --no-attach    Don\'t attach to session after starting');
  log('  --help, -h     Show this help');
  console.log('');
}

// Main
async function main() {
  const args = process.argv.slice(2);

  // Parse options
  const noAttach = args.includes('--no-attach');
  const showHelpFlag = args.includes('--help') || args.includes('-h');
  const setupFlag = args.includes('--setup');
  const filteredArgs = args.filter(a => !a.startsWith('--') && a !== '-h');

  if (showHelpFlag) {
    showHelp();
    process.exit(0);
  }

  if (setupFlag) {
    setupAliases();
    process.exit(0);
  }

  console.log('');
  logHeader('┌─────────────────────────────────────────┐');
  logHeader('│         RemOrch Connect                 │');
  logHeader('│         AI CLI Remote Access            │');
  logHeader('└─────────────────────────────────────────┘');
  console.log('');

  // If command provided, start in tmux
  if (filteredArgs.length > 0) {
    const command = filteredArgs.join(' ');
    const sessionName = filteredArgs[0].replace(/[^a-zA-Z0-9]/g, ''); // Sanitize

    log(`${colors.bright}Starting:${colors.reset} ${command}`);
    log(`${colors.bright}Session:${colors.reset}  ${sessionName}`);
    console.log('');

    const result = createSessionWithCommand(sessionName, command);

    if (result.created) {
      logSuccess(`✓ Created tmux session "${sessionName}"`);
      logSuccess(`✓ Started "${command}"`);
    } else if (result.existed) {
      log(`${colors.yellow}→ Using existing session "${sessionName}"${colors.reset}`);
    } else {
      logError(`✗ Failed to create session`);
      process.exit(1);
    }
    console.log('');

    // Show connection info
    await showConnectionInfo(sessionName);

    // Attach to session
    if (!noAttach) {
      log(`${colors.bright}Attaching to session...${colors.reset}`);
      logDim('(Press Ctrl+B, then D to detach)');
      console.log('');

      // Small delay before attaching
      setTimeout(() => {
        attachToSession(sessionName);
      }, 500);
    } else {
      logDim('Session running in background.');
      logDim(`Attach later with: tmux attach -t ${sessionName}`);
    }
  } else {
    // Just show connection info
    await showConnectionInfo();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
