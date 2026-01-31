import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import DockerBotManager from './DockerBotManager';
import { 
  Terminal, 
  FolderOpen, 
  Bot, 
  Github, 
  Server, 
  Power, 
  RefreshCw,
  FileText,
  Folder,
  ChevronRight,
  Play,
  Square,
  Trash2,
  Download,
  Upload,
  Settings,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Network,
  Database,
  Lock,
  Unlock,
  Copy,
  Edit,
  Eye,
  Package,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'success' | 'info';
  content: string;
  timestamp: Date;
}

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size?: string;
  modified?: string;
  permissions?: string;
}

interface BotStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastCheck: Date;
  uptime?: string;
  username?: string;
  link?: string;
}

interface ProcessInfo {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
}

// Virtual filesystem
const virtualFS: Record<string, FileItem[]> = {
  '/home/admin': [
    { name: 'telegram-bots', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: 'edge-functions', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: 'docker-compose.yml', type: 'file', size: '2.4 KB', permissions: '-rw-r--r--' },
    { name: 'bot-config.json', type: 'file', size: '1.2 KB', permissions: '-rw-r--r--' },
    { name: '.env', type: 'file', size: '512 B', permissions: '-rw-------' },
    { name: 'logs', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: 'backups', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: '.bashrc', type: 'file', size: '3.5 KB', permissions: '-rw-r--r--' },
    { name: '.ssh', type: 'folder', permissions: 'drwx------' },
  ],
  '/home/admin/telegram-bots': [
    { name: 'solana-soldier', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: 'ai-worker', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: 'bot-monitor', type: 'folder', permissions: 'drwxr-xr-x' },
  ],
  '/home/admin/logs': [
    { name: 'access.log', type: 'file', size: '156 KB', permissions: '-rw-r--r--' },
    { name: 'error.log', type: 'file', size: '24 KB', permissions: '-rw-r--r--' },
    { name: 'docker.log', type: 'file', size: '89 KB', permissions: '-rw-r--r--' },
  ],
  '/etc': [
    { name: 'passwd', type: 'file', size: '2.1 KB', permissions: '-rw-r--r--' },
    { name: 'hosts', type: 'file', size: '256 B', permissions: '-rw-r--r--' },
    { name: 'nginx', type: 'folder', permissions: 'drwxr-xr-x' },
    { name: 'docker', type: 'folder', permissions: 'drwxr-xr-x' },
  ],
  '/var/log': [
    { name: 'syslog', type: 'file', size: '1.2 MB', permissions: '-rw-r-----' },
    { name: 'auth.log', type: 'file', size: '456 KB', permissions: '-rw-r-----' },
    { name: 'kern.log', type: 'file', size: '234 KB', permissions: '-rw-r-----' },
  ],
};

export default function AdminVMTerminal() {
  const [activeTab, setActiveTab] = useState('terminal');
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<TerminalLine[]>([
    { id: 1, type: 'info', content: '╔═══════════════════════════════════════════════════════════════╗', timestamp: new Date() },
    { id: 2, type: 'info', content: '║        CF ADMIN VIRTUAL MACHINE TERMINAL v2.0                  ║', timestamp: new Date() },
    { id: 3, type: 'info', content: '║        Linux Ubuntu 22.04 LTS | Docker Desktop | Root Access   ║', timestamp: new Date() },
    { id: 4, type: 'info', content: '╚═══════════════════════════════════════════════════════════════╝', timestamp: new Date() },
    { id: 5, type: 'success', content: 'System initialized. Type "help" for available commands.', timestamp: new Date() },
  ]);
  const [currentPath, setCurrentPath] = useState('/home/admin');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [files, setFiles] = useState<FileItem[]>([
    { name: 'telegram-bots', type: 'folder' },
    { name: 'edge-functions', type: 'folder' },
    { name: 'docker-compose.yml', type: 'file', size: '2.4 KB' },
    { name: 'bot-config.json', type: 'file', size: '1.2 KB' },
    { name: '.env', type: 'file', size: '512 B' },
    { name: 'logs', type: 'folder' },
    { name: 'backups', type: 'folder' },
  ]);
  const [bots, setBots] = useState<BotStatus[]>([
    { name: 'CF Solana Soldier', status: 'running', lastCheck: new Date(), uptime: '24h 32m', username: '@CFSolanaSoldierBot', link: 'https://t.me/CFSolanaSoldierBot' },
    { name: 'AI Worker Bot', status: 'running', lastCheck: new Date(), uptime: '24h 32m', username: '@CFAGENTAIV2_BOT', link: 'https://t.me/CFAGENTAIV2_BOT' },
    { name: 'Bot Monitor Cron', status: 'running', lastCheck: new Date(), uptime: '24h 32m', username: 'System', link: '' },
  ]);
  const [sshConnected, setSshConnected] = useState(false);
  const [sshHost, setSshHost] = useState('');
  const [sshUser, setSshUser] = useState('admin');
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const addLine = (type: TerminalLine['type'], content: string) => {
    setHistory(prev => [...prev, { 
      id: prev.length + 1, 
      type, 
      content, 
      timestamp: new Date() 
    }]);
  };

  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    const parts = trimmedCmd.split(' ');
    const mainCmd = parts[0];
    const args = parts.slice(1);

    addLine('input', `${currentPath}$ ${cmd}`);
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);

    switch (mainCmd) {
      case 'help':
        addLine('output', `
╔═══════════════════════════════════════════════════════════════╗
║                    AVAILABLE COMMANDS                          ║
╠═══════════════════════════════════════════════════════════════╣
║  FILE SYSTEM:                                                   ║
║    ls [-la]        - List files and directories                ║
║    cd <path>       - Change directory                          ║
║    pwd             - Print working directory                   ║
║    cat <file>      - View file contents                        ║
║    mkdir <name>    - Create directory                          ║
║    rmdir <name>    - Remove directory                          ║
║    rm [-rf] <file> - Remove file or directory                  ║
║    touch <file>    - Create empty file                         ║
║    cp <src> <dst>  - Copy file                                 ║
║    mv <src> <dst>  - Move/rename file                          ║
║    chmod <mode>    - Change file permissions                   ║
║    chown <user>    - Change file owner                         ║
║    find <pattern>  - Find files                                ║
║    grep <pattern>  - Search in files                           ║
║    head/tail       - View file start/end                       ║
║    wc              - Word count                                ║
║                                                                 ║
║  SYSTEM INFO:                                                   ║
║    neofetch        - System information                        ║
║    htop            - Process monitor                           ║
║    top             - Process list                              ║
║    ps aux          - Process status                            ║
║    df -h           - Disk usage                                ║
║    du -sh          - Directory size                            ║
║    free -m         - Memory usage                              ║
║    uname -a        - Kernel info                               ║
║    uptime          - System uptime                             ║
║    whoami          - Current user                              ║
║    id              - User/group IDs                            ║
║    hostname        - System hostname                           ║
║    date            - Current date/time                         ║
║    cal             - Calendar                                  ║
║                                                                 ║
║  NETWORK:                                                       ║
║    ifconfig        - Network interfaces                        ║
║    ip addr         - IP addresses                              ║
║    ping <host>     - Ping host                                 ║
║    curl <url>      - HTTP request                              ║
║    wget <url>      - Download file                             ║
║    netstat         - Network statistics                        ║
║    ss              - Socket statistics                         ║
║    nslookup        - DNS lookup                                ║
║    traceroute      - Trace route                               ║
║                                                                 ║
║  DOCKER:                                                        ║
║    docker ps       - List containers                           ║
║    docker images   - List images                               ║
║    docker start    - Start container                           ║
║    docker stop     - Stop container                            ║
║    docker logs     - View logs                                 ║
║    docker exec     - Execute in container                      ║
║    docker build    - Build image                               ║
║    docker-compose  - Compose commands                          ║
║                                                                 ║
║  PACKAGE MANAGEMENT:                                            ║
║    apt update      - Update package list                       ║
║    apt upgrade     - Upgrade packages                          ║
║    apt install     - Install package                           ║
║    apt remove      - Remove package                            ║
║    apt search      - Search packages                           ║
║                                                                 ║
║  BOTS:                                                          ║
║    bot status      - Check all bot statuses                    ║
║    bot restart     - Restart bots                              ║
║    bot logs        - View bot logs                             ║
║                                                                 ║
║  OTHER:                                                         ║
║    clear           - Clear terminal                            ║
║    history         - Command history                           ║
║    echo <text>     - Print text                                ║
║    exit            - Exit SSH session                          ║
║    sudo <cmd>      - Run as root                               ║
║    man <cmd>       - Manual page                               ║
║    which <cmd>     - Find command location                     ║
║    alias           - Show aliases                              ║
╚═══════════════════════════════════════════════════════════════╝`);
        break;

      case 'clear':
        setHistory([]);
        break;

      case 'ls':
      case 'dir':
        handleLsCommand(args);
        break;

      case 'pwd':
        addLine('output', currentPath);
        break;

      case 'cd':
        handleCdCommand(args);
        break;

      case 'whoami':
        addLine('output', 'admin');
        break;

      case 'id':
        addLine('output', 'uid=1000(admin) gid=1000(admin) groups=1000(admin),27(sudo),999(docker)');
        break;

      case 'hostname':
        addLine('output', 'cf-admin-vm');
        break;

      case 'date':
        addLine('output', new Date().toString());
        break;

      case 'uptime':
        addLine('output', ` ${new Date().toLocaleTimeString()}  up 24:32,  1 user,  load average: 0.52, 0.48, 0.44`);
        break;

      case 'uname':
        if (args.includes('-a')) {
          addLine('output', 'Linux cf-admin-vm 5.15.0-generic #1 SMP Ubuntu x86_64 GNU/Linux');
        } else {
          addLine('output', 'Linux');
        }
        break;

      case 'cal':
        const now = new Date();
        addLine('output', `     ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}
Su Mo Tu We Th Fr Sa
                1  2  3
 4  5  6  7  8  9 10
11 12 13 14 15 16 17
18 19 20 21 22 23 24
25 26 27 28 29 30 31`);
        break;

      case 'echo':
        addLine('output', args.join(' '));
        break;

      case 'touch':
        if (args[0]) {
          addLine('success', `Created file: ${args[0]}`);
        } else {
          addLine('error', 'touch: missing file operand');
        }
        break;

      case 'mkdir':
        if (args[0]) {
          addLine('success', `Created directory: ${args[0]}`);
        } else {
          addLine('error', 'mkdir: missing operand');
        }
        break;

      case 'rm':
        if (args[0]) {
          addLine('success', `Removed: ${args.filter(a => !a.startsWith('-')).join(', ')}`);
        } else {
          addLine('error', 'rm: missing operand');
        }
        break;

      case 'cp':
        if (args.length >= 2) {
          addLine('success', `Copied ${args[0]} to ${args[1]}`);
        } else {
          addLine('error', 'cp: missing file operand');
        }
        break;

      case 'mv':
        if (args.length >= 2) {
          addLine('success', `Moved ${args[0]} to ${args[1]}`);
        } else {
          addLine('error', 'mv: missing file operand');
        }
        break;

      case 'chmod':
        if (args.length >= 2) {
          addLine('success', `Changed permissions of ${args[1]} to ${args[0]}`);
        } else {
          addLine('error', 'chmod: missing operand');
        }
        break;

      case 'sudo':
        if (args.length > 0) {
          addLine('info', '[sudo] password for admin: ');
          setTimeout(() => {
            addLine('success', `Executing: ${args.join(' ')}`);
          }, 500);
        } else {
          addLine('error', 'usage: sudo <command>');
        }
        break;

      case 'apt':
      case 'apt-get':
        handleAptCommand(args);
        break;

      case 'ping':
        if (args[0]) {
          addLine('info', `PING ${args[0]} (127.0.0.1) 56(84) bytes of data.`);
          for (let i = 1; i <= 4; i++) {
            setTimeout(() => {
              addLine('output', `64 bytes from ${args[0]}: icmp_seq=${i} ttl=64 time=${(Math.random() * 10 + 1).toFixed(1)} ms`);
            }, i * 500);
          }
          setTimeout(() => {
            addLine('success', `--- ${args[0]} ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss`);
          }, 2500);
        } else {
          addLine('error', 'ping: missing host');
        }
        break;

      case 'ifconfig':
      case 'ip':
        addLine('output', `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.0.2.15  netmask 255.255.255.0  broadcast 10.0.2.255
        inet6 fe80::a00:27ff:fe8e:8aa8  prefixlen 64  scopeid 0x20<link>
        ether 08:00:27:8e:8a:a8  txqueuelen 1000  (Ethernet)
        RX packets 12543  bytes 15234567 (14.5 MiB)
        TX packets 8234  bytes 1234567 (1.1 MiB)

docker0: flags=4099<UP,BROADCAST,MULTICAST>  mtu 1500
        inet 172.17.0.1  netmask 255.255.0.0  broadcast 172.17.255.255
        ether 02:42:ac:11:00:01  txqueuelen 0  (Ethernet)`);
        break;

      case 'netstat':
        addLine('output', `Active Internet connections
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:3001            0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:5432            0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:6379            0.0.0.0:*               LISTEN`);
        break;

      case 'curl':
        if (args[0]) {
          addLine('info', `Connecting to ${args[0]}...`);
          setTimeout(() => {
            addLine('success', `HTTP/1.1 200 OK\nContent-Type: text/html\n\n<!DOCTYPE html>...`);
          }, 1000);
        } else {
          addLine('error', 'curl: try \'curl --help\' for more information');
        }
        break;

      case 'wget':
        if (args[0]) {
          addLine('info', `--${new Date().toISOString()}--  ${args[0]}`);
          addLine('info', 'Resolving host... done.');
          setTimeout(() => {
            addLine('success', `'index.html' saved [12345/12345]`);
          }, 1500);
        } else {
          addLine('error', 'wget: missing URL');
        }
        break;

      case 'grep':
        if (args.length >= 1) {
          addLine('output', `Searching for "${args[0]}"...\nMatched 3 lines in 2 files.`);
        } else {
          addLine('error', 'Usage: grep <pattern> [file]');
        }
        break;

      case 'find':
        addLine('output', `${currentPath}/telegram-bots
${currentPath}/edge-functions
${currentPath}/logs
${currentPath}/backups`);
        break;

      case 'history':
        addLine('output', commandHistory.map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n'));
        break;

      case 'alias':
        addLine('output', `alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias docker-logs='docker logs -f'
alias dc='docker-compose'`);
        break;

      case 'which':
        if (args[0]) {
          addLine('output', `/usr/bin/${args[0]}`);
        } else {
          addLine('error', 'which: missing argument');
        }
        break;

      case 'man':
        if (args[0]) {
          addLine('output', `${args[0].toUpperCase()}(1)                User Commands                ${args[0].toUpperCase()}(1)

NAME
       ${args[0]} - ${args[0]} command

SYNOPSIS
       ${args[0]} [OPTION]...

DESCRIPTION
       This is a simulated man page for ${args[0]}.
       
Press q to exit.`);
        } else {
          addLine('error', 'What manual page do you want?');
        }
        break;

      case 'docker':
        handleDockerCommand(args);
        break;

      case 'docker-compose':
        handleDockerComposeCommand(args);
        break;

      case 'bot':
        await handleBotCommand(args);
        break;

      case 'git':
        handleGitCommand(args);
        break;

      case 'ssh':
        if (args[0]) {
          addLine('info', `Connecting to ${args[0]}...`);
          setTimeout(() => {
            setSshConnected(true);
            setSshHost(args[0]);
            addLine('success', `Connected to ${args[0]} as ${sshUser}`);
            addLine('info', 'Type "exit" to disconnect');
          }, 1500);
        } else {
          addLine('error', 'Usage: ssh <hostname>');
        }
        break;

      case 'exit':
        if (sshConnected) {
          setSshConnected(false);
          addLine('info', `Disconnected from ${sshHost}`);
          setSshHost('');
        }
        break;

      case 'neofetch':
        addLine('output', `
       .-/+oossssoo+/-.              admin@cf-admin-vm
    \`:+ssssssssssssssssss+:\`          ─────────────────
  -+sssssssssssssssssssyyssss+-       OS: Ubuntu 22.04.3 LTS x86_64
 /ssssssssssssssssssssssdMMMNysss/    Host: Lovable Cloud VM
:sssssssssssssssssssshNMMMNdysss:     Kernel: 5.15.0-generic
+sssssssssssssyssssyhMMMMNssss+       Uptime: 24 hours, 32 mins
ossssssssssssNMMMMNhyssss/            Packages: 1847 (apt)
ossssssssssssNMMNNhyssss/             Shell: bash 5.1.16
+sssssssssssshNNNdyssss+              Terminal: CF Admin Terminal v2.0
:sssssssssssssyyyyyysss:              CPU: 4x Intel Xeon @ 2.4GHz
 /sssssssssssssssssss/                Memory: 2.1GB / 8GB
  -+sssssssssssssss+-                 Disk: 42GB / 100GB
    \`:+ssssssssss+:\`                  Docker: 24.0.5
       .-/+oossoo+/-.                 Bots: 3 running
`);
        break;

      case 'df':
        addLine('output', `
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       100G   42G   58G  42% /
tmpfs           4.0G     0  4.0G   0% /dev/shm
/dev/sdb1       500G  120G  380G  24% /data
overlay          50G   12G   38G  24% /var/lib/docker/overlay2
`);
        break;

      case 'free':
        addLine('output', `
               total        used        free      shared  buff/cache   available
Mem:           8192        2100        3800         256        2292        5600
Swap:          4096         512        3584
`);
        break;

      case 'htop':
      case 'top':
        addLine('output', `
  CPU[||||||||||||||||                ] 42.4%    Tasks: 124, 412 thr; 3 running
  Mem[||||||||||||||||||              ] 51.2%    Load average: 0.52 0.48 0.44
  Swp[||||                            ] 12.5%    Uptime: 24:32:15

  PID USER      PRI  NI  VIRT   RES   SHR S CPU% MEM%   TIME+  Command
    1 root       20   0  168M  13.2M  8.5M S  0.0  0.2  0:02.45 systemd
  245 root       20   0  125M  45.2M  12M  S  1.2  0.6  0:45.12 dockerd
  892 admin      20   0  892M  156M   42M  S  2.4  1.9  1:23.45 node solana-bot
  893 admin      20   0  756M  124M   38M  S  1.8  1.5  0:58.23 node ai-worker
 1024 admin      20   0  125M   28M   15M  S  0.5  0.3  0:12.34 bot-monitor
 1234 root       20   0   45M   12M    8M  S  0.1  0.1  0:05.67 sshd
 2345 admin      20   0  234M   56M   23M  S  0.8  0.7  0:34.56 nginx
 3456 root       20   0  512M  234M   45M  S  1.5  2.9  1:45.23 postgres

Press q to exit.`);
        break;

      case 'ps':
        addLine('output', `
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.2 168892 13200 ?        Ss   00:00   0:02 /sbin/init
root       245  1.2  0.6 128000 45200 ?        Ssl  00:00   0:45 dockerd
admin      892  2.4  1.9 913408 156000 ?       Sl   00:00   1:23 node /app/solana-bot
admin      893  1.8  1.5 774144 124000 ?       Sl   00:00   0:58 node /app/ai-worker
admin     1024  0.5  0.3 128000 28000 ?        S    00:00   0:12 /app/bot-monitor`);
        break;

      case 'cat':
        if (args[0]) {
          handleCatCommand(args[0]);
        } else {
          addLine('error', 'Usage: cat <filename>');
        }
        break;

      case 'systemctl':
        handleSystemctlCommand(args);
        break;

      default:
        addLine('error', `bash: ${mainCmd}: command not found`);
    }

    setCommand('');
  };

  const handleLsCommand = (args: string[]) => {
    const showDetails = args.includes('-l') || args.includes('-la') || args.includes('-al');
    const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
    
    const currentFiles = virtualFS[currentPath] || virtualFS['/home/admin'];
    const filesToShow = showHidden ? currentFiles : currentFiles.filter(f => !f.name.startsWith('.'));
    
    if (showDetails) {
      const lines = filesToShow.map(f => {
        const perm = f.permissions || (f.type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--');
        const size = f.size || '4.0K';
        const date = 'Jan 15 14:30';
        return `${perm} 1 admin admin ${size.padStart(6)} ${date} ${f.name}${f.type === 'folder' ? '/' : ''}`;
      });
      addLine('output', `total ${filesToShow.length * 4}\n${lines.join('\n')}`);
    } else {
      addLine('output', filesToShow.map(f => 
        f.type === 'folder' ? `📁 ${f.name}/` : `📄 ${f.name}`
      ).join('\n'));
    }
  };

  const handleCdCommand = (args: string[]) => {
    if (!args[0] || args[0] === '~') {
      setCurrentPath('/home/admin');
      addLine('success', 'Changed to /home/admin');
    } else if (args[0] === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      const newPath = '/' + parts.join('/') || '/';
      setCurrentPath(newPath);
      addLine('success', `Changed to ${newPath}`);
    } else if (args[0] === '/') {
      setCurrentPath('/');
      addLine('success', 'Changed to /');
    } else if (args[0].startsWith('/')) {
      setCurrentPath(args[0]);
      addLine('success', `Changed to ${args[0]}`);
    } else {
      const newPath = `${currentPath}/${args[0]}`.replace(/\/+/g, '/');
      setCurrentPath(newPath);
      addLine('success', `Changed to ${newPath}`);
    }
  };

  const handleAptCommand = (args: string[]) => {
    switch (args[0]) {
      case 'update':
        addLine('info', 'Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease');
        addLine('info', 'Get:2 http://security.ubuntu.com/ubuntu jammy-security InRelease');
        setTimeout(() => {
          addLine('success', 'Reading package lists... Done\nAll packages are up to date.');
        }, 1000);
        break;
      case 'upgrade':
        addLine('info', 'Reading package lists... Done');
        addLine('info', 'Building dependency tree... Done');
        setTimeout(() => {
          addLine('success', '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');
        }, 1500);
        break;
      case 'install':
        if (args[1]) {
          addLine('info', `Reading package lists... Done`);
          addLine('info', `Setting up ${args[1]}...`);
          setTimeout(() => {
            addLine('success', `${args[1]} is already the newest version.`);
          }, 1000);
        } else {
          addLine('error', 'E: Invalid operation install');
        }
        break;
      case 'remove':
        if (args[1]) {
          addLine('info', `Removing ${args[1]}...`);
          setTimeout(() => {
            addLine('success', `${args[1]} has been removed.`);
          }, 800);
        } else {
          addLine('error', 'E: Invalid operation remove');
        }
        break;
      case 'search':
        if (args[1]) {
          addLine('output', `Sorting... Done\n${args[1]} - ${args[1]} package\n${args[1]}-dev - Development files`);
        } else {
          addLine('error', 'E: You must give at least one search pattern');
        }
        break;
      default:
        addLine('error', `E: Invalid operation ${args[0] || ''}`);
    }
  };

  const handleDockerComposeCommand = (args: string[]) => {
    switch (args[0]) {
      case 'up':
        addLine('info', 'Creating network "cf_default" with the default driver');
        addLine('info', 'Creating solana-soldier ... done');
        addLine('info', 'Creating ai-worker      ... done');
        addLine('info', 'Creating bot-monitor    ... done');
        addLine('success', 'All containers started successfully');
        break;
      case 'down':
        addLine('info', 'Stopping solana-soldier ... done');
        addLine('info', 'Stopping ai-worker      ... done');
        addLine('info', 'Stopping bot-monitor    ... done');
        addLine('success', 'All containers stopped and removed');
        break;
      case 'logs':
        addLine('output', `solana-soldier  | [INFO] Bot running on port 3000
ai-worker       | [INFO] Worker running on port 3001
bot-monitor     | [INFO] Monitoring active`);
        break;
      case 'ps':
        addLine('output', `NAME            SERVICE         STATUS          PORTS
solana-soldier  solana-bot      running         0.0.0.0:3000->3000/tcp
ai-worker       ai-worker       running         0.0.0.0:3001->3001/tcp
bot-monitor     bot-monitor     running         `);
        break;
      default:
        addLine('info', `docker-compose ${args.join(' ')}`);
    }
  };

  const handleSystemctlCommand = (args: string[]) => {
    switch (args[0]) {
      case 'status':
        const service = args[1] || 'docker';
        addLine('output', `● ${service}.service - ${service} Service
     Loaded: loaded (/lib/systemd/system/${service}.service; enabled)
     Active: active (running) since Mon 2024-01-15 00:00:00 UTC; 24h ago
   Main PID: 245 (${service})
      Tasks: 42 (limit: 4915)
     Memory: 156.2M
        CPU: 2min 34.567s`);
        break;
      case 'start':
        addLine('success', `Started ${args[1] || 'service'}`);
        break;
      case 'stop':
        addLine('success', `Stopped ${args[1] || 'service'}`);
        break;
      case 'restart':
        addLine('success', `Restarting ${args[1] || 'service'}...`);
        break;
      case 'enable':
        addLine('success', `Created symlink for ${args[1] || 'service'}`);
        break;
      case 'disable':
        addLine('success', `Removed symlink for ${args[1] || 'service'}`);
        break;
      default:
        addLine('output', `  systemctl [COMMAND] [SERVICE]
  Commands: status, start, stop, restart, enable, disable`);
    }
  };

  const handleDockerCommand = (args: string[]) => {
    switch (args[0]) {
      case 'ps':
        addLine('output', `
CONTAINER ID   IMAGE                    STATUS          PORTS                    NAMES
a1b2c3d4e5f6   cf-solana-bot:latest     Up 24 hours     0.0.0.0:3000->3000/tcp   solana-soldier
b2c3d4e5f6a1   cf-ai-worker:latest      Up 24 hours     0.0.0.0:3001->3001/tcp   ai-worker
c3d4e5f6a1b2   cf-bot-monitor:latest    Up 24 hours                              bot-monitor
d4e5f6a1b2c3   postgres:15              Up 24 hours     0.0.0.0:5432->5432/tcp   db
e5f6a1b2c3d4   redis:7                  Up 24 hours     0.0.0.0:6379->6379/tcp   cache
`);
        break;

      case 'images':
        addLine('output', `
REPOSITORY          TAG       IMAGE ID       CREATED        SIZE
cf-solana-bot       latest    sha256:a1b2    2 days ago     892MB
cf-ai-worker        latest    sha256:b2c3    2 days ago     756MB
cf-bot-monitor      latest    sha256:c3d4    2 days ago     125MB
postgres            15        sha256:d4e5    1 week ago     412MB
redis               7         sha256:e5f6    1 week ago     138MB
node                20        sha256:f6a1    2 weeks ago    1.1GB
`);
        break;

      case 'logs':
        addLine('output', `
[2024-01-15 14:32:15] INFO: Bot started successfully
[2024-01-15 14:32:16] INFO: Connected to Telegram API
[2024-01-15 14:35:22] INFO: Processed 15 messages
[2024-01-15 14:40:01] INFO: Health check passed
[2024-01-15 14:45:00] INFO: Scheduled task completed
`);
        break;

      case 'exec':
        if (args[1]) {
          addLine('success', `Executing in container ${args[1]}...`);
        } else {
          addLine('error', 'Error: Container name required');
        }
        break;

      case 'start':
        addLine('success', `Container ${args[1] || 'unknown'} started`);
        break;

      case 'stop':
        addLine('success', `Container ${args[1] || 'unknown'} stopped`);
        break;

      case 'build':
        addLine('info', 'Building image...');
        setTimeout(() => {
          addLine('success', 'Successfully built image');
        }, 1500);
        break;

      case 'pull':
        addLine('info', `Pulling ${args[1] || 'image'}...`);
        setTimeout(() => {
          addLine('success', `Downloaded newer image for ${args[1] || 'image'}`);
        }, 1500);
        break;

      default:
        addLine('info', `Docker command: docker ${args.join(' ')}`);
    }
  };

  const handleBotCommand = async (args: string[]) => {
    switch (args[0]) {
      case 'status':
        addLine('output', `
╔═══════════════════════════════════════════════════════════╗
║                    BOT STATUS REPORT                       ║
╠═══════════════════════════════════════════════════════════╣
║  Bot Name              │ Status   │ Uptime    │ Last Check║
╠═══════════════════════════════════════════════════════════╣
║  CF Solana Soldier     │ 🟢 UP    │ 24h 32m   │ Just now  ║
║  AI Worker Bot         │ 🟢 UP    │ 24h 32m   │ Just now  ║
║  Bot Monitor Cron      │ 🟢 UP    │ 24h 32m   │ Just now  ║
╚═══════════════════════════════════════════════════════════╝
`);
        break;

      case 'restart':
        const botName = args[1] || 'all';
        addLine('info', `Restarting ${botName}...`);
        try {
          const response = await supabase.functions.invoke('telegram-bot-monitor');
          if (response.error) throw response.error;
          addLine('success', `✓ ${botName} restarted successfully`);
          toast.success(`${botName} restarted`);
        } catch (error) {
          addLine('error', `Failed to restart ${botName}`);
        }
        break;

      case 'logs':
        addLine('output', `
[INFO] 2024-01-15 14:45:00 - Health check initiated
[INFO] 2024-01-15 14:45:01 - Checking Solana Soldier status...
[SUCCESS] 2024-01-15 14:45:02 - Solana Soldier is online
[INFO] 2024-01-15 14:45:03 - Checking AI Worker status...
[SUCCESS] 2024-01-15 14:45:04 - AI Worker is online
[INFO] 2024-01-15 14:45:05 - All bots operational
`);
        break;

      default:
        addLine('error', 'Usage: bot <status|restart|stop|logs> [bot-name]');
    }
  };

  const handleGitCommand = (args: string[]) => {
    switch (args[0]) {
      case 'status':
        addLine('output', `
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
`);
        break;

      case 'pull':
        addLine('info', 'Fetching from origin...');
        setTimeout(() => {
          addLine('success', `
From github.com:cf-platform/cf-bots
 * branch            main       -> FETCH_HEAD
Already up to date.
`);
        }, 1000);
        break;

      case 'log':
        addLine('output', `
commit a1b2c3d4 (HEAD -> main, origin/main)
Author: Admin <admin@cfplatform.com>
Date:   Mon Jan 15 14:30:00 2024

    feat: Add bot monitoring cron job

commit b2c3d4e5
Author: Admin <admin@cfplatform.com>
Date:   Sun Jan 14 10:15:00 2024

    fix: Improve webhook reliability
`);
        break;

      default:
        addLine('info', `Git command: git ${args.join(' ')}`);
    }
  };

  const handleCatCommand = (filename: string) => {
    const fileContents: Record<string, string> = {
      'docker-compose.yml': `
version: '3.8'
services:
  solana-bot:
    image: cf-solana-bot:latest
    ports:
      - "3000:3000"
    environment:
      - TELEGRAM_BOT_TOKEN=\${TELEGRAM_SOLANA_BOT_TOKEN}
    restart: always

  ai-worker:
    image: cf-ai-worker:latest
    ports:
      - "3001:3001"
    environment:
      - TELEGRAM_BOT_TOKEN=\${TELEGRAM_AI_WORKER_BOT_TOKEN}
    restart: always
`,
      'bot-config.json': `
{
  "bots": [
    {
      "name": "CF Solana Soldier",
      "enabled": true,
      "webhook": "/telegram-solana-bot"
    },
    {
      "name": "AI Worker",
      "enabled": true,
      "webhook": "/telegram-ai-worker-bot"
    }
  ],
  "monitoring": {
    "interval": "5m",
    "autoRestart": true
  }
}
`,
      '.env': `
# Telegram Bots
TELEGRAM_SOLANA_BOT_TOKEN=***HIDDEN***
TELEGRAM_AI_WORKER_BOT_TOKEN=***HIDDEN***

# Database
DATABASE_URL=***HIDDEN***

# API Keys
OPENROUTER_API_KEY=***HIDDEN***
`
    };

    if (fileContents[filename]) {
      addLine('output', fileContents[filename]);
    } else {
      addLine('error', `cat: ${filename}: No such file or directory`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && command.trim()) {
      executeCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const restartBot = async (botName: string) => {
    toast.info(`Restarting ${botName}...`);
    try {
      await supabase.functions.invoke('telegram-bot-monitor');
      setBots(prev => prev.map(b => 
        b.name === botName ? { ...b, status: 'running', lastCheck: new Date() } : b
      ));
      toast.success(`${botName} restarted successfully`);
    } catch (error) {
      toast.error(`Failed to restart ${botName}`);
    }
  };

  return (
    <div className="glass-card p-0 overflow-hidden animate-fade-in h-[800px]">
      {/* VM Header */}
      <div className="bg-gray-900 border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white">CF Admin Virtual Machine</h2>
            <p className="text-xs text-gray-400">Ubuntu 22.04 LTS | Docker Desktop</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-green-400">
              <Wifi className="w-3 h-3" />
              <span>Connected</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Cpu className="w-3 h-3" />
              <span>32%</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <HardDrive className="w-3 h-3" />
              <span>42GB</span>
            </div>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-72px)]">
        <TabsList className="w-full justify-start rounded-none bg-gray-800/50 border-b border-white/5 p-0 h-auto">
          <TabsTrigger value="terminal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent py-3 px-4 gap-2">
            <Terminal className="w-4 h-4" />
            Terminal
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent py-3 px-4 gap-2">
            <FolderOpen className="w-4 h-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="bots" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent py-3 px-4 gap-2">
            <Bot className="w-4 h-4" />
            Bots
          </TabsTrigger>
          <TabsTrigger value="docker" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent py-3 px-4 gap-2">
            <Server className="w-4 h-4" />
            Docker
          </TabsTrigger>
          <TabsTrigger value="deploy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:bg-transparent py-3 px-4 gap-2">
            <Zap className="w-4 h-4" />
            Deploy Bots
          </TabsTrigger>
          <TabsTrigger value="github" className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent py-3 px-4 gap-2">
            <Github className="w-4 h-4" />
            GitHub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terminal" className="h-full m-0 p-0">
          <div className="h-full bg-gray-950 flex flex-col">
            {/* Terminal Output */}
            <ScrollArea className="flex-1 p-4" ref={terminalRef}>
              <div className="font-mono text-sm space-y-1">
                {history.map((line) => (
                  <div 
                    key={line.id} 
                    className={`whitespace-pre-wrap ${
                      line.type === 'input' ? 'text-cyan-400' :
                      line.type === 'error' ? 'text-red-400' :
                      line.type === 'success' ? 'text-green-400' :
                      line.type === 'info' ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}
                  >
                    {line.content}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Terminal Input */}
            <div className="border-t border-white/10 p-4 bg-gray-900/50">
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-green-400">
                  {sshConnected ? `${sshUser}@${sshHost}` : 'admin@cf-vm'}
                </span>
                <span className="text-gray-500">:</span>
                <span className="text-blue-400">{currentPath}</span>
                <span className="text-gray-500">$</span>
                <Input
                  ref={inputRef}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 p-0 h-auto text-white font-mono"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="files" className="h-full m-0 p-4 bg-gray-900/50">
          <div className="space-y-4">
            {/* Path bar */}
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-3 border border-white/5">
              <FolderOpen className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-300">{currentPath}</span>
            </div>

            {/* File actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </Button>
              <Button size="sm" variant="outline" className="gap-2">
                <Folder className="w-4 h-4" />
                New Folder
              </Button>
              <Button size="sm" variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                New File
              </Button>
            </div>

            {/* File list */}
            <div className="bg-gray-800/30 rounded-lg border border-white/5 divide-y divide-white/5">
              {files.map((file) => (
                <div 
                  key={file.name}
                  className="flex items-center justify-between p-3 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {file.type === 'folder' ? (
                      <Folder className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-white">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {file.size && <span className="text-xs text-gray-500">{file.size}</span>}
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bots" className="h-full m-0 p-4 bg-gray-900/50">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Bot Management</h3>
              <Button size="sm" className="gap-2 bg-cyan-600 hover:bg-cyan-700" onClick={() => restartBot('all')}>
                <RefreshCw className="w-4 h-4" />
                Restart All
              </Button>
            </div>

            <div className="grid gap-4">
              {bots.map((bot) => (
                <div 
                  key={bot.name}
                  className="bg-gray-800/50 rounded-xl border border-white/10 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        bot.status === 'running' ? 'bg-green-500 animate-pulse' :
                        bot.status === 'stopped' ? 'bg-gray-500' :
                        'bg-red-500'
                      }`} />
                      <div>
                        <h4 className="font-semibold text-white">{bot.name}</h4>
                        <p className="text-xs text-gray-400">
                          Uptime: {bot.uptime} • Last check: {bot.lastCheck.toLocaleTimeString()}
                        </p>
                        {bot.username && bot.link && (
                          <a 
                            href={bot.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 block"
                          >
                            {bot.username} →
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {bot.status === 'running' ? (
                        <Button size="sm" variant="outline" className="gap-1 text-red-400 border-red-400/30 hover:bg-red-400/10">
                          <Square className="w-3 h-3" />
                          Stop
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1 text-green-400 border-green-400/30 hover:bg-green-400/10">
                          <Play className="w-3 h-3" />
                          Start
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => restartBot(bot.name)}>
                        <RefreshCw className="w-3 h-3" />
                        Restart
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Activity className="w-3 h-3" />
                        Logs
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="docker" className="h-full m-0 p-4 bg-gray-900/50">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Docker Containers</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-lg border border-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr className="text-left">
                    <th className="p-3 text-gray-400 font-medium">Container</th>
                    <th className="p-3 text-gray-400 font-medium">Image</th>
                    <th className="p-3 text-gray-400 font-medium">Status</th>
                    <th className="p-3 text-gray-400 font-medium">Ports</th>
                    <th className="p-3 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/5">
                    <td className="p-3 text-white">solana-soldier</td>
                    <td className="p-3 text-gray-400">cf-solana-bot:latest</td>
                    <td className="p-3"><span className="text-green-400">● Running</span></td>
                    <td className="p-3 text-gray-400">3000</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Square className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="p-3 text-white">ai-worker</td>
                    <td className="p-3 text-gray-400">cf-ai-worker:latest</td>
                    <td className="p-3"><span className="text-green-400">● Running</span></td>
                    <td className="p-3 text-gray-400">3001</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Square className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="p-3 text-white">bot-monitor</td>
                    <td className="p-3 text-gray-400">cf-bot-monitor:latest</td>
                    <td className="p-3"><span className="text-green-400">● Running</span></td>
                    <td className="p-3 text-gray-400">-</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Square className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Deploy Bots Tab */}
        <TabsContent value="deploy" className="h-full m-0 p-4 bg-gray-900/50 overflow-auto">
          <DockerBotManager />
        </TabsContent>

        <TabsContent value="github" className="h-full m-0 p-4 bg-gray-900/50">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">GitHub Repository</h3>
              <div className="flex gap-2">
                <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4" />
                  Pull Latest
                </Button>
                <Button size="sm" variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Push Changes
                </Button>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-3 mb-4">
                <Github className="w-6 h-6 text-white" />
                <div>
                  <h4 className="font-semibold text-white">cf-platform/cf-bots</h4>
                  <p className="text-xs text-gray-400">Private repository • main branch</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">●</span>
                  <span className="text-gray-300">Branch: main</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">Last sync: 2 hours ago</span>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3 font-mono text-xs">
                  <div className="text-gray-400">Latest commit:</div>
                  <div className="text-white mt-1">a1b2c3d4 - feat: Add bot monitoring cron job</div>
                  <div className="text-gray-500 mt-1">by Admin • 2 hours ago</div>
                </div>
              </div>
            </div>

            {/* Recent commits */}
            <div className="bg-gray-800/30 rounded-lg border border-white/5">
              <div className="p-3 border-b border-white/5">
                <h4 className="font-medium text-white">Recent Commits</h4>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { hash: 'a1b2c3d', msg: 'feat: Add bot monitoring cron job', time: '2 hours ago' },
                  { hash: 'b2c3d4e', msg: 'fix: Improve webhook reliability', time: '1 day ago' },
                  { hash: 'c3d4e5f', msg: 'chore: Update dependencies', time: '2 days ago' },
                  { hash: 'd4e5f6g', msg: 'feat: Add AI worker bot', time: '3 days ago' },
                ].map((commit) => (
                  <div key={commit.hash} className="p-3 flex items-center justify-between hover:bg-white/5">
                    <div className="flex items-center gap-3">
                      <code className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">{commit.hash}</code>
                      <span className="text-sm text-white">{commit.msg}</span>
                    </div>
                    <span className="text-xs text-gray-500">{commit.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
