const mongoose = require('mongoose');
const dns = require('node:dns');

// En Windows, el resolutor SRV de Node (c-ares) a veces toma el DNS de un
// adaptador de red virtual inactivo (VPN, VirtualBox, Docker, Hyper-V) en vez
// del adaptador real, causando "querySrv ECONNREFUSED" aunque Compass o el
// navegador sí resuelvan el mismo host sin problema. Forzamos DNS públicos
// conocidos para que la consulta SRV de mongodb+srv:// no dependa de eso.
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'donaciones_db' });
    console.log('MongoDB conectado correctamente');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = connectDB;
