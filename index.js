const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestWaWebVersion,
  Browsers,
} = require('baileys-pro');
const { handleMensagem } = require('./dialogos');
const P = require('pino');
const readline = require('readline');

// Caminho da sessão
const authFile = './QR';

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve =>
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function startBot() {
  console.log(
    '⚠️ Lembre-se: Caso tenha problemas de conexão, apague a pasta "./QR"\n'
  );

  const { state, saveCreds } = await useMultiFileAuthState('./QR');
  const version = [2, 3000, 1025200398]; // versão forçada
  console.log('🧩 Usando versão forçada do WhatsApp Web:', version);

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false, // Desativa QR code no terminal
    browser: Browsers.macOS('Safari'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
    },
  });

  // 📲 Pairing Code automático
  if (!sock.authState.creds.registered) {
    const numero = await askQuestion(
      '📞 Digite seu número no formato DDI + DDD + número (ex: 5511999999999): '
    );

    if (!/^\d{12,13}$/.test(numero)) {
      console.log('❌ Número inválido. Certifique-se de usar apenas números.');
      process.exit(1);
    }

    const codigoPareamento = await sock.requestPairingCode(numero);
    console.log(`📲 Código de pareamento gerado: ${codigoPareamento}`);
    console.log(
      '✅ Vá até o WhatsApp > Aparelhos Conectados > Conectar com código e insira esse código.'
    );
  }

  // Eventos de conexão
  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('✅ Conectado com sucesso!');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Conexão fechada, status code:', statusCode);
      console.log('⚠️ Se precisar, apague a pasta "./QR" e reconecte.');

      // 🔁 Reiniciar o bot automaticamente se for erro 515 (ex: pareamento expirado)
      if (statusCode === 515) {
        console.log('🔁 Reiniciando o bot devido ao código 515...');
        await startBot(); // reinicia o bot
      }
    }
  });

  // Mensagens recebidas
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    if (from.endsWith('@g.us')) {
      await sock.groupLeave(from);
      console.log('👋 Saí do grupo automaticamente ao receber mensagem!');
      return;
    }

    const text = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''
    ).trim();

    console.log(`📩 Mensagem recebida de ${from}: ${text}`);
    await handleMensagem(sock, msg);
  });

  // Atualizar credenciais
  sock.ev.on('creds.update', saveCreds);
}

startBot();

// Tratamento de erros
process.on('uncaughtException', err => {
  console.error('❌ Erro não tratado:', err);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('❌ Promessa rejeitada não tratada:', err);
  process.exit(1);
});
