/**
 * Fórmulas de fila M/M/c.
 *
 * Notação:
 * - λ (arrivalRate): chegadas por segundo.
 * - S (serviceTimeS): tempo médio de serviço, em segundos.
 * - c (servers): número de servidores em paralelo.
 * - a = λ × S: carga oferecida, em Erlangs.
 * - ρ = a / c: utilização por servidor.
 */

export interface QueueMetrics {
  /** a = λ × S, em Erlangs. */
  offeredLoad: number;
  /** ρ = a / c. Pode passar de 1 quando saturado. */
  utilization: number;
  /** a >= c: a fila cresce sem limite. */
  saturated: boolean;
  /** Probabilidade de esperar (Erlang C). */
  waitProbability: number;
  /** Wq, em segundos. Infinity se saturado. */
  waitTimeS: number;
  /** R = S + Wq, em segundos. Infinity se saturado. */
  responseTimeS: number;
  /** Lq = λ × Wq. Infinity se saturado. */
  queueLength: number;
  /** L = λ × R. Infinity se saturado. */
  inSystem: number;
}

export class QueueModel {
  /**
   * Erlang B pela recorrência B(0) = 1, B(k) = a·B(k−1) / (k + a·B(k−1)).
   * Evita fatoriais e potências, sendo estável para c grande.
   */
  static erlangB(servers: number, offeredLoad: number): number {
    assertServers(servers);
    if (!(offeredLoad >= 0)) throw new RangeError('A carga oferecida deve ser >= 0.');
    let b = 1;
    for (let k = 1; k <= servers; k++) {
      b = (offeredLoad * b) / (k + offeredLoad * b);
    }
    return b;
  }

  /**
   * Erlang C: probabilidade de uma chegada precisar esperar numa fila M/M/c.
   * Calculada a partir de Erlang B: C = c·B / (c − a·(1 − B)).
   * Retorna 1 quando a >= c (toda chegada espera).
   */
  static erlangC(servers: number, offeredLoad: number): number {
    assertServers(servers);
    if (!(offeredLoad >= 0)) throw new RangeError('A carga oferecida deve ser >= 0.');
    if (offeredLoad === 0) return 0;
    if (offeredLoad >= servers) return 1;
    const b = QueueModel.erlangB(servers, offeredLoad);
    return (servers * b) / (servers - offeredLoad * (1 - b));
  }

  /** Métricas de uma fila M/M/c em regime estacionário. */
  static analyze(arrivalRate: number, serviceTimeS: number, servers: number): QueueMetrics {
    assertServers(servers);
    if (!(arrivalRate >= 0) || !Number.isFinite(arrivalRate)) {
      throw new RangeError('A taxa de chegada deve ser um número finito >= 0.');
    }
    if (!(serviceTimeS >= 0) || !Number.isFinite(serviceTimeS)) {
      throw new RangeError('O tempo de serviço deve ser um número finito >= 0.');
    }

    const offeredLoad = arrivalRate * serviceTimeS;
    const utilization = offeredLoad / servers;

    if (offeredLoad >= servers) {
      return {
        offeredLoad,
        utilization,
        saturated: true,
        waitProbability: 1,
        waitTimeS: Infinity,
        responseTimeS: Infinity,
        queueLength: Infinity,
        inSystem: Infinity,
      };
    }

    const waitProbability = QueueModel.erlangC(servers, offeredLoad);
    const waitTimeS =
      waitProbability === 0 ? 0 : (waitProbability * serviceTimeS) / (servers - offeredLoad);
    const responseTimeS = serviceTimeS + waitTimeS;

    return {
      offeredLoad,
      utilization,
      saturated: false,
      waitProbability,
      waitTimeS,
      responseTimeS,
      queueLength: arrivalRate * waitTimeS,
      inSystem: arrivalRate * responseTimeS,
    };
  }

  /**
   * Menor número de servidores que mantém a utilização <= maxUtilization.
   * Retorna 0 quando não há carga.
   */
  static requiredServers(offeredLoad: number, maxUtilization: number): number {
    if (!(offeredLoad >= 0) || !Number.isFinite(offeredLoad)) {
      throw new RangeError('A carga oferecida deve ser um número finito >= 0.');
    }
    if (!(maxUtilization > 0 && maxUtilization <= 1)) {
      throw new RangeError('A utilização máxima deve estar em (0, 1].');
    }
    if (offeredLoad === 0) return 0;
    // Tolerância relativa para que 1,6 / 0,8 = 2,0000000000000004 resulte em 2.
    const exact = offeredLoad / maxUtilization;
    return Math.ceil(exact * (1 - 1e-12));
  }
}

function assertServers(servers: number): void {
  if (!Number.isInteger(servers) || servers < 1) {
    throw new RangeError('O número de servidores deve ser um inteiro >= 1.');
  }
}
