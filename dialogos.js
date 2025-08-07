const pedidosPorUser = {}; // Guarda pedidos por usuário (jid)
const axios = require('axios');

async function handleMensagem(sock, msg) {
  const from = msg.key.remoteJid;
  let text = '';

  // Extrair texto digitado ou botão/lista selecionado
  if (msg.message?.conversation) {
    text = msg.message.conversation.trim();
  } else if (msg.message?.extendedTextMessage) {
    text = msg.message.extendedTextMessage.text.trim();
  } else if (msg.message?.buttonsResponseMessage) {
    text = msg.message.buttonsResponseMessage.selectedButtonId;
  } else if (msg.message?.listResponseMessage) {
    text =
      msg.message.listResponseMessage.singleSelectReply?.selectedRowId ||
      msg.message.listResponseMessage.title;
  }

  if (!text) return;

  // Verificação manual de pagamento
  if (
    text.toLowerCase() === 'verificar pagamento' &&
    pedidosPorUser[from]?.idPagamento
  ) {
    await verificarStatusPagamento(
      pedidosPorUser[from].idPagamento,
      sock,
      from
    );
    return;
  }

  // --- ARRAYS DE PRODUTOS DISPONÍVEIS EM TODO O FLUXO ---
  const pizzasSalgadas = [
    {
      title: 'Calabresa R$ 45,00',
      description: 'Calabresa, cebola e mussarela',
      img: 'https://i.ibb.co/SDVQCS5J/calabresa.png',
      rowId: 'sabor calabresa',
      frase: 'A clássica que nunca decepciona!',
      preco: 45.0,
    },
    {
      title: 'Frango com Catupiry R$ 47,00',
      description: 'Frango desfiado com catupiry',
      img: 'https://i.ibb.co/RT8f1BRj/blog-receita-frango-catupiry.jpg',
      rowId: 'sabor frango',
      frase: 'Cremosa e irresistível!',
      preco: 47.0,
    },
    {
      title: 'Portuguesa R$ 49,00',
      description: 'Presunto, ovo, cebola e azeitona',
      img: 'https://i.ibb.co/rKf9jX0V/portuguesa.jpg',
      rowId: 'sabor portuguesa',
      frase: 'Uma explosão de sabores tradicionais!',
      preco: 49.0,
    },
  ];

  const pizzasDoces = [
    {
      title: 'Chocolate com Morango R$ 52,00',
      description: 'Chocolate ao leite e morango',
      img: 'https://i.ibb.co/cSqjQqhm/chocolatemorango.webp',
      rowId: 'sabor chocolatemorango',
      frase: 'A união perfeita do doce com o azedinho do morango!',
      preco: 52.0,
    },
    {
      title: 'Prestígio R$ 50,00',
      description: 'Chocolate e coco',
      img: 'https://i.ibb.co/JRxG3fY4/prestigio.jpg',
      rowId: 'sabor prestigio',
      frase: 'Para quem ama coco e chocolate juntos!',
      preco: 50.0,
    },
  ];

  const bebidas = [
    {
      title: 'Refrigerante 2L Coca-Cola R$ 10,00',
      description: 'Refrigerante 2L Coca-Cola',
      img: 'https://i.ibb.co/xS0fPWfV/coca.png',
      rowId: 'bebida refri2l coca',
      frase: 'Clássica e gelada para acompanhar sua pizza!',
      preco: 10.0,
    },
    {
      title: 'Refrigerante 2L Pepsi R$ 9,50',
      description: 'Refrigerante 2L Pepsi',
      img: 'https://i.ibb.co/0RYQwf3G/pepsi.webp',
      rowId: 'bebida refri2l Pepsi',
      frase: 'Refrescância garantida!',
      preco: 9.5,
    },
    {
      title: 'Refrigerante 2L Guaraná Antártica R$ 9,00',
      description: 'Refrigerante 2L Guaraná Antártica',
      img: 'https://i.ibb.co/GvpsDfXp/guarana.jpg',
      rowId: 'bebida refri2l Guaraná Antártica',
      frase: 'O sabor brasileiro que não pode faltar!',
      preco: 9.0,
    },
    {
      title: 'Suco Natural Laranja R$ 8,00',
      description: 'Laranja, Uva, Maracujá',
      img: 'https://i.ibb.co/s9bSw0nZ/sucolaranja.webp',
      rowId: 'bebida suco laranja',
      frase: 'Natural e cheio de vitamina C!',
      preco: 8.0,
    },
    {
      title: 'Suco Natural Uva R$ 8,00',
      description: 'Laranja, Uva, Maracujá',
      img: 'https://i.ibb.co/xych8st/sucouva.webp',
      rowId: 'bebida suco uva',
      frase: 'O sabor da uva direto para sua mesa!',
      preco: 8.0,
    },
    {
      title: 'Suco Natural Maracujá R$ 8,00',
      description: 'Laranja, Uva, Maracujá',
      img: 'https://i.ibb.co/9mkXHDQ3/sucomaracuja.webp',
      rowId: 'bebida suco maracuja',
      frase: 'Refrescante e levemente azedinho!',
      preco: 8.0,
    },
    {
      title: 'Não quero bebida',
      description: 'Sem bebida',
      img: 'https://i.ibb.co/zWmMVrb0/sem-bebida.png',
      rowId: 'bebida nenhum',
      frase: 'Prefere sem bebida? Sem problemas!',
      preco: 0.0,
    },
  ];

  // Inicializar estrutura do pedido se necessário
  if (!pedidosPorUser[from]) {
    pedidosPorUser[from] = {
      etapa: 'tipo',
      tipo: null,
      sabor: null,
      bebida: null,
      tentativasEndereco: 0,
      jaOrientouMenu: false,
      atendimentoHumano: false, // flag para atendimento humano
    };
  }

  const pedido = pedidosPorUser[from];

  // Se já está em atendimento humano, não responde mais automaticamente
  if (pedido.atendimentoHumano) {
    // Aqui você pode notificar um atendente real, se desejar
    return;
  }

  // Fluxo por etapas
  if (pedido.etapa === 'tipo' || text.toLowerCase() === 'menu') {
    // Definindo saudação conforme horário
    const hora = new Date().getHours();
    let saudacao = 'Olá';
    if (hora >= 6 && hora < 12) saudacao = 'Bom dia';
    else if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';
    else saudacao = 'Boa noite';

    // Envia a imagem do logo com a mensagem de boas-vindas
    await sock.sendMessage(from, {
      image: { url: 'https://i.ibb.co/cSTdn85L/Copilot-20250805-124207.png' }, // Troque pela URL do seu logo
      caption: `Olá ${saudacao}, seja bem-vindo à Pizzaria do Zé!\nQual seu pedido hoje?`,
    });

    // Em seguida, envia o menu de tipos de pizza
    await sock.sendMessage(from, {
      text: 'Escolha o tipo de pizza:',
      sections: [
        {
          title: 'Tipos de Pizza',
          rows: [
            { title: 'Salgada', rowId: 'tipo salgada' },
            { title: 'Doce', rowId: 'tipo doce' },
          ],
        },
      ],
      buttonText: 'Selecionar tipo',
      headerType: 1,
    });
    pedido.etapa = 'tipo_aguardando';
    return;
  }

  // Escolha do tipo
  if (pedido.etapa === 'tipo_aguardando') {
    if (text === 'tipo salgada') {
      pedido.tipo = 'salgada';
      pedido.etapa = 'sabor';
    } else if (text === 'tipo doce') {
      pedido.tipo = 'doce';
      pedido.etapa = 'sabor';
    } else if (text.toLowerCase() === 'falar com um atendente') {
      await sock.sendMessage(from, {
        text: 'Você será transferido para um atendimento humanizado. Aguarde o contato de um atendente.',
      });
      pedido.atendimentoHumano = true;

      // Reseta o atendimento humanizado após 1 hora
      setTimeout(() => {
        if (pedidosPorUser[from]) {
          pedidosPorUser[from].atendimentoHumano = false;
          pedidosPorUser[from].jaOrientouMenu = false; // opcional: reseta orientação do menu também
        }
      }, 60 * 60 * 1000); // 1 hora em ms

      return;
    } else {
      await sock.sendMessage(from, {
        text: 'Opção inválida. Para atendimento humano, digite: *falar com um atendente*',
      });
      return;
    }
  }

  // Escolha do sabor
  if (pedido.etapa === 'sabor') {
    if (pedido.tipo === 'salgada') {
      const cards = pizzasSalgadas.map(pizza => ({
        title: pizza.title,
        image: { url: pizza.img },
        caption: `${pizza.description}\n\n${pizza.frase}`,
      }));

      await sock.sendMessage(from, {
        text: 'Escolha o sabor da pizza salgada:',
        footer: 'Veja as opções abaixo.',
        viewOnce: true,
        cards,
      });

      await sock.sendMessage(from, {
        text: 'Selecione o sabor da pizza salgada:',
        sections: [
          {
            title: 'Sabores Salgados',
            rows: pizzasSalgadas.map(pizza => ({
              title: pizza.title,
              description: pizza.description,
              rowId: pizza.rowId,
            })),
          },
        ],
        buttonText: 'Selecionar sabor',
        headerType: 1,
      });

      pedido.etapa = 'sabor_aguardando';
      return;
    } else {
      const cardsDoces = pizzasDoces.map(pizza => ({
        title: pizza.title,
        image: { url: pizza.img },
        caption: `${pizza.description}\n\n${pizza.frase}`,
      }));

      await sock.sendMessage(from, {
        text: 'Escolha o sabor da pizza doce:',
        footer: 'Veja as opções abaixo.',
        viewOnce: true,
        cards: cardsDoces,
      });

      await sock.sendMessage(from, {
        text: 'Selecione o sabor da pizza doce:',
        sections: [
          {
            title: 'Sabores Doces',
            rows: pizzasDoces.map(pizza => ({
              title: pizza.title,
              description: pizza.description,
              rowId: pizza.rowId,
            })),
          },
        ],
        buttonText: 'Selecionar sabor',
        headerType: 1,
      });

      pedido.etapa = 'sabor_aguardando';
      return;
    }
  }

  if (pedido.etapa === 'sabor_aguardando') {
    if (text.startsWith('sabor ')) {
      pedido.sabor = text.replace('sabor ', '');
      pedido.etapa = 'bebida';
    } else {
      await sock.sendMessage(from, {
        text: 'Escolha um sabor válido. Responda conforme instrução do card.',
      });
      return;
    }
  }

  // Escolha da bebida
  if (pedido.etapa === 'bebida') {
    const cardsBebidas = bebidas.map(bebida => ({
      title: bebida.title,
      image: { url: bebida.img },
      caption: `${bebida.description}\n\n${bebida.frase}`,
    }));

    await sock.sendMessage(from, {
      text: 'Deseja adicionar uma bebida?',
      footer: 'Veja as opções abaixo.',
      viewOnce: true,
      cards: cardsBebidas,
    });

    await sock.sendMessage(from, {
      text: 'Selecione a bebida desejada:',
      sections: [
        {
          title: 'Bebidas',
          rows: bebidas.map(bebida => ({
            title: bebida.title,
            description: bebida.description,
            rowId: bebida.rowId,
          })),
        },
      ],
      buttonText: 'Selecionar bebida',
      headerType: 1,
    });

    pedido.etapa = 'bebida_aguardando';
    return;
  }

  if (pedido.etapa === 'bebida_aguardando') {
    if (text.startsWith('bebida ')) {
      pedido.bebida = text.replace('bebida ', '');
      pedido.etapa = 'finalizado';
    } else {
      await sock.sendMessage(from, {
        text: 'Escolha uma opção de bebida. Responda conforme instrução do card.',
      });
      return;
    }
  }

  // Finalização
  if (pedido.etapa === 'finalizado') {
    await sock.sendMessage(from, {
      text: '📍 Por favor, digite seu endereço completo para calcularmos o tempo de entrega.',
    });
    pedido.etapa = 'aguardando_endereco';
    return;
  }

  if (pedido.etapa === 'aguardando_endereco') {
    pedido.endereco = text;
    pedido.tentativasEndereco = (pedido.tentativasEndereco || 0) + 1;

    const coordenadas = await obterCoordenadasNominatim(pedido.endereco);

    if (!coordenadas) {
      if (pedido.tentativasEndereco >= 3) {
        await sock.sendMessage(from, {
          text:
            'Não consegui localizar esse endereço após 3 tentativas.\n' +
            'Seu pedido será enviado com o endereço informado e será verificado manualmente pelo atendente.',
        });

        // Envia resumo do pedido com aviso manual (sem Pix)
        await sock.sendMessage(from, {
          text:
            `📝 *Resumo do seu pedido:*\n` +
            `🍕 Tipo: ${pedido.tipo}\n` +
            `🍽️ Sabor: ${pedido.sabor}\n` +
            `🥤 Bebida: ${
              pedido.bebida === 'nenhum' ? 'Nenhuma' : pedido.bebida
            }\n` +
            `📍 Endereço: ${pedido.endereco}\n\n` +
            `⚠️ Endereço não localizado automaticamente. Será verificado manualmente pelo atendente.\n\n` +
            `Obrigado por pedir na Pizzaria do Zé! Para novo pedido, digite "menu".`,
        });

        delete pedidosPorUser[from];
        return;
      } else {
        await sock.sendMessage(from, {
          text: `Não consegui localizar esse endereço. Por favor, revise e envie novamente. (${pedido.tentativasEndereco}/3 tentativas)`,
        });
        return;
      }
    }

    // Se chegou aqui, endereço foi localizado!
    const pizzaria = { lat: -23.47051451502922, lng: -46.692908398115588 };
    const resultado = await calcularDistanciaOSRM(coordenadas, pizzaria);

    // Calcula valor total do pedido
    const saborSelecionado = [...pizzasSalgadas, ...pizzasDoces].find(
      p => p.rowId === `sabor ${pedido.sabor}`
    );
    const bebidaSelecionada = bebidas.find(
      b => b.rowId === `bebida ${pedido.bebida}`
    );
    const precoPizza = saborSelecionado ? saborSelecionado.preco : 0;
    const precoBebida = bebidaSelecionada ? bebidaSelecionada.preco : 0;
    const valorTotal = precoPizza + precoBebida;

    // Gera pagamento Pix
    const pagamento = await gerarPixMercadoPago(
      valorTotal,
      'Pedido Pizzaria do Zé',
      from.replace(/[^0-9]/g, '') + '@email.com',
      sock,
      from
    );

    if (!pagamento) return null;

    pedido.idPagamento = pagamento.id; // guarda o ID para monitorar

    // Envia resumo
    const resumo =
      `📝 *Resumo do seu pedido:*\n` +
      `🍕 Tipo: ${pedido.tipo}\n` +
      `🍽️ Sabor: ${pedido.sabor}\n` +
      `🥤 Bebida: ${pedido.bebida === 'nenhum' ? 'Nenhuma' : pedido.bebida}\n` +
      `📍 Endereço: ${pedido.endereco}\n\n` +
      `💰 Valor total: R$ ${valorTotal.toFixed(2)}`;

    await sock.sendMessage(from, {
      text: resumo,
    });

    console.log(
      `🧾 Pedido recebido do cliente ${from.replace(/[^0-9]/g, '')}:\n${resumo}`
    );

    // Envia QR Code
    await sock.sendMessage(from, {
      text: `💸 *Pagamento via Pix:*\n\nCopie o código abaixo para pagar:\n\n`,
    });
    await sock.sendMessage(from, { text: `${pagamento.qr_code}` });

    const base64Data = pagamento.qr_code_base64.replace(
      /^data:image\/png;base64,/,
      ''
    );
    const buffer = Buffer.from(base64Data, 'base64');
    await sock.sendMessage(from, {
      image: buffer,
      caption: '📸 *Escaneie o QR Code para pagar com Pix*',
    });

    // --- Inicia verificação automática do pagamento ---
    verificarPagamentoAutomatico(pedido.idPagamento, sock, from);

    delete pedidosPorUser[from];
    return;
  }

  // Orientação para usuário fora do fluxo
  if (
    !pedido.etapa || // não está em nenhuma etapa do fluxo
    (pedido.etapa !== 'tipo' &&
      pedido.etapa !== 'tipo_aguardando' &&
      pedido.etapa !== 'sabor' &&
      pedido.etapa !== 'sabor_aguardando' &&
      pedido.etapa !== 'bebida' &&
      pedido.etapa !== 'bebida_aguardando' &&
      pedido.etapa !== 'finalizado' &&
      pedido.etapa !== 'aguardando_endereco')
  ) {
    if (!pedido.jaOrientouMenu) {
      await sock.sendMessage(from, {
        text: 'Para fazer um pedido, digite *menu*. Caso queira falar com um atendente, basta enviar sua mensagem normalmente.',
      });
      pedido.jaOrientouMenu = true;
    }
    // Não retorna, assim o atendente pode responder normalmente depois
  }
}

async function verificarPagamentoAutomatico(idPagamento, sock, from) {
  const token =
    'APP_USR-2174162631355492-080611-3eb5796bd0f10dac97f6b1ef6482a788-156687911';
  let tentativas = 0;
  const intervalo = setInterval(async () => {
    tentativas++;

    try {
      const response = await axios.get(
        `https://api.mercadopago.com/v1/payments/${idPagamento}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const status = response.data.status;

      if (status === 'approved') {
        clearInterval(intervalo);
        await sock.sendMessage(from, {
          text: '✅ *Pagamento aprovado!*\n🍕 Seu pedido foi enviado para a cozinha!',
        });
      } else if (status === 'rejected') {
        clearInterval(intervalo);
        await sock.sendMessage(from, {
          text: '❌ Pagamento rejeitado. Verifique no aplicativo do banco.',
        });
      } else if (tentativas >= 20) {
        // limite de tentativas (20x30s = 10 minutos)
        clearInterval(intervalo);
        await sock.sendMessage(from, {
          text: '⏳ Pagamento não confirmado em tempo hábil. Verifique e tente novamente.',
        });
      }
    } catch (error) {
      console.error(
        'Erro ao verificar pagamento:',
        error.response?.data || error.message
      );
    }
  }, 30000); // 30 segundos entre verificações
}

async function verificarStatusPagamento(idPagamento, sock, from) {
  const token =
    'APP_USR-2174162631355492-080611-3eb5796bd0f10dac97f6b1ef6482a788-156687911'; // seu token
  try {
    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${idPagamento}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const status = response.data.status;
    const cliente = from.replace(/[^0-9]/g, '');
    console.log(
      `📦 [Tentativa ${tentativas}] Pagamento do cliente ${cliente}: ${status.toUpperCase()}`
    );

    console.log(`📦 Pagamento do cliente ${cliente}: ${status.toUpperCase()}`);

    if (status === 'approved') {
      await sock.sendMessage(from, {
        text: '✅ Pagamento aprovado!\n🍕 Seu pedido será direcionado à cozinha!',
      });
    } else if (status === 'pending') {
      await sock.sendMessage(from, {
        text: '⏳ Pagamento ainda pendente. Tente novamente em alguns minutos.',
      });
    } else {
      await sock.sendMessage(from, {
        text: `❌ Pagamento com status: ${status}. Verifique no aplicativo do banco.`,
      });
    }
  } catch (error) {
    console.error(
      '❌ Erro ao verificar pagamento:',
      error.response?.data || error.message
    );
    await sock.sendMessage(from, {
      text: 'Erro ao consultar o status do pagamento. Tente novamente mais tarde.',
    });
  }
}

// Função para obter coordenadas usando Nominatim (OpenStreetMap)
async function obterCoordenadasNominatim(endereco) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    endereco
  )}`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'PizzariaBot/1.0' },
    });
    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Erro ao consultar Nominatim:', error);
    return null;
  }
}

// Função para calcular distância e tempo via OSRM
async function calcularDistanciaOSRM(origem, destino) {
  const url = `http://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=false`;

  try {
    const response = await axios.get(url);
    if (
      response.data &&
      response.data.routes &&
      response.data.routes.length > 0
    ) {
      const rota = response.data.routes[0];
      return {
        distancia: rota.distance, // em metros
        duracao: rota.duration, // em segundos
      };
    }
    return null;
  } catch (error) {
    console.error('Erro ao consultar OSRM:', error);
    return null;
  }
}

async function gerarPixMercadoPago(valor, descricao, emailCliente, sock, from) {
  const token =
    'APP_USR-2174162631355492-080611-3eb5796bd0f10dac97f6b1ef6482a788-156687911'; // Seu token real
  const url = 'https://api.mercadopago.com/v1/payments';

  const body = {
    transaction_amount: valor,
    description: descricao,
    payment_method_id: 'pix',
    payer: { email: emailCliente || 'comprador@email.com' },
  };

  const idempotencyKey = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  console.log('Enviando para Mercado Pago:', body);

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey,
      },
    });

    return {
      id: response.data.id,
      qr_code: response.data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        response.data.point_of_interaction.transaction_data.qr_code_base64,
    };
  } catch (err) {
    console.error('Erro Mercado Pago:', err.response?.data || err.message);
    await sock.sendMessage(from, {
      text: '❌ Erro ao gerar o pagamento via Pix. Tente novamente ou fale com o atendente.',
    });
    return null;
  }
}

module.exports = {
  handleMensagem,
  calcularDistanciaOSRM,
  obterCoordenadasNominatim,
  gerarPixMercadoPago,
};
