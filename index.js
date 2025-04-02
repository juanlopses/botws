const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

async function connectToWhatsApp() {
    // Inicializa el estado de autenticación para guardar y restaurar la sesión.
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    // Obtiene la última versión compatible de Baileys.
    const { version } = await fetchLatestBaileysVersion();

    // Crea la conexión de WhatsApp sin imprimir el QR en el terminal, para utilizar el Pairing Code.
    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false, // Debe ser false para conexión con Pairing Code
        browser: ['WhatsApp Bot', 'Safari', '1.0.0']
    });

    // Guarda las credenciales cuando se actualizan.
    sock.ev.on('creds.update', saveCreds);

    // Monitorea los cambios en la conexión.
    sock.ev.on('connection.update', async (update) => {
        console.log('Actualización de conexión:', update);

        if (update.connection === 'open') {
            console.log('¡Conexión establecida!');
        } else if (update.connection === 'close') {
            const shouldReconnect = 
                update.lastDisconnect &&
                (update.lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Conexión cerrada. Reintentando conexión:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
    });

    // Si el dispositivo no está registrado, se solicita el Pairing Code.
    if (!sock.authState.creds.registered) {
        // El número de teléfono debe incluir el código de país sin símbolos adicionales.
        const phoneNumber = '1234567890'; // Reemplaza con el número de teléfono real (ejemplo: "14155552671")
        try {
            const pairingCode = await sock.requestPairingCode(phoneNumber);
            console.log('Utiliza el siguiente Pairing Code en tu aplicación WhatsApp:', pairingCode);
        } catch (err) {
            console.error('Error al solicitar el Pairing Code:', err);
        }
    }

    // Escucha los mensajes entrantes y responde automáticamente.
    sock.ev.on('messages.upsert', async ({ messages }) => {
        console.log('Mensajes recibidos:', messages);
        for (const msg of messages) {
            const jid = msg.key.remoteJid;
            console.log('Enviando respuesta a:', jid);
            await sock.sendMessage(jid, { text: 'Hola, soy tu bot de WhatsApp usando Pairing Code en Node.js' });
        }
    });
}

connectToWhatsApp().catch(err => console.error('Error inesperado:', err));
