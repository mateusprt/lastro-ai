/**
 * Explicações curtas dos termos da interface, para quem não conhece teoria de
 * filas nem o vocabulário de infraestrutura. Os botões "?" leem daqui.
 */
export interface GlossaryEntry {
  /** Nome exibido no topo da explicação. */
  term: string;
  text: string;
  /** Exemplo ou analogia, em uma frase. */
  example?: string;
}

export const GLOSSARY = {
  traffic: {
    term: 'Acessos por segundo (req/s)',
    text: 'Quantas requisições chegam ao sistema a cada segundo. Cada clique, carregamento de página ou chamada do app conta como uma ou mais requisições.',
    example: '100 req/s são 360 mil requisições por hora, ou 8,6 milhões por dia.',
  },
  safeUtilization: {
    term: 'Ocupação máxima aceitável',
    text: 'Até quanto cada componente pode ficar ocupado sem risco. Perto de 100%, qualquer pico forma fila e o tempo de resposta dispara. 80% é um padrão comum.',
    example: 'É o traço vertical que aparece nos medidores.',
  },
  utilization: {
    term: 'Ocupação (utilização)',
    text: 'Quanto do tempo as instâncias passam trabalhando. 50% quer dizer que, em média, elas ficam ocupadas metade do tempo.',
  },
  safeCapacity: {
    term: 'Aguenta com folga até',
    text: 'O maior número de acessos por segundo em que todos os componentes ficam abaixo da ocupação máxima aceitável.',
  },
  responseTime: {
    term: 'Tempo de resposta',
    text: 'Quanto o usuário espera, em média, do pedido até a resposta. Soma o atendimento e a espera na fila de cada componente do caminho.',
  },
  bottleneck: {
    term: 'Gargalo',
    text: 'O componente que chega ao limite primeiro quando os acessos crescem. Reforçar outro componente não aumenta a capacidade enquanto o gargalo continuar o mesmo.',
  },
  saturated: {
    term: 'Sobrecarregado',
    text: 'Chegam mais requisições do que o componente consegue atender. A fila cresce sem parar e o tempo de resposta deixa de ter limite.',
  },
  instances: {
    term: 'Instâncias',
    text: 'Quantas cópias do componente atendem ao mesmo tempo: servidores, containers ou processos. Mais instâncias dividem a carga entre si.',
  },
  serviceTime: {
    term: 'Tempo para atender (tempo de serviço)',
    text: 'Quanto uma instância leva para processar uma requisição, sem contar a espera na fila.',
    example: 'Para estimar pelas métricas: ocupação × instâncias ÷ req/s. Ex.: 50% × 4 ÷ 100 req/s = 20 ms.',
  },
  latency: {
    term: 'Tempo de resposta do serviço (latência)',
    text: 'Quanto um serviço de terceiros, como um gateway de pagamento, leva para responder. O Lastro não calcula fila para ele, porque a capacidade dele não depende da sua arquitetura.',
  },
  throughput: {
    term: 'Recebe (vazão)',
    text: 'Quantas requisições por segundo chegam a este componente, somando todos os caminhos que levam até ele.',
  },
  entryPoint: {
    term: 'Ponto de entrada',
    text: 'O componente onde os acessos dos usuários chegam primeiro, normalmente o balanceador ou a API. O tráfego dos demais é calculado a partir dele, seguindo as ligações.',
  },
  callsPerRequest: {
    term: 'Chamadas por requisição',
    text: 'Para cada requisição que chega na origem, quantas vezes ela chama o destino.',
    example: '1 = sempre; 0,4 = em 40% das vezes; 2 = duas vezes cada.',
  },
  async: {
    term: 'Não espera a resposta (assíncrona)',
    text: 'A origem entrega o trabalho e segue em frente, como ao deixar uma mensagem numa fila. Gera carga no destino, mas não aumenta o tempo que o usuário espera.',
  },
  background: {
    term: 'Trabalho em segundo plano',
    text: 'Quanto tempo leva para concluir o que foi disparado por ligações que não esperam a resposta, como processar um pedido depois de confirmado.',
  },
  replicas: {
    term: 'Primário e réplicas',
    text: 'Num banco com mais de uma instância, o primário recebe todas as gravações e as réplicas, que são cópias dele, dividem as leituras. Mais réplicas aumentam a capacidade de leitura, mas não a de gravação.',
  },
  writeFraction: {
    term: 'Consultas que gravam dados',
    text: 'A parte das consultas que cria, altera ou apaga dados (INSERT, UPDATE, DELETE). Todas vão para o primário.',
    example: 'Ex.: salvar um pedido ou editar um perfil. Sem dados medidos, 20% é um palpite razoável.',
  },
  requiredInstances: {
    term: 'Instâncias recomendadas',
    text: 'Quantas instâncias o componente precisa para ficar abaixo da ocupação máxima aceitável com os acessos de agora.',
  },
  curve: {
    term: 'Curva do tempo de resposta',
    text: 'Mostra o tempo de resposta para cada volume de acessos. Ele fica quase estável e depois dispara perto da capacidade. Esse ponto de virada é o "joelho" da curva.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

