import { networkInterfaces } from 'os';
import { spawn } from 'child_process';

function getLanAddress() {
  const nets = networkInterfaces();
  for (const interfaces of Object.values(nets)) {
    if (!interfaces) continue;
    for (const net of interfaces) {
      if (!net || net.internal) continue;
      if (net.family === 'IPv4') {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const lanIp = getLanAddress();
const apiUrl = `http://${lanIp}:3000`;

console.log(`→ Starting client dev server using API_URL=${apiUrl}`);

const child = spawn('npm', ['--prefix', 'apps/client', 'run', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    API_URL: apiUrl,
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
