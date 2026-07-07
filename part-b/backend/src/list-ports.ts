import { SerialPort } from 'serialport';

const ports = await SerialPort.list();

if (ports.length === 0) {
  console.log('No serial ports detected.');
  process.exit(0);
}

for (const port of ports) {
  console.log(`${port.path}\t${port.manufacturer ?? 'unknown'}\t${port.serialNumber ?? 'n/a'}`);
}
