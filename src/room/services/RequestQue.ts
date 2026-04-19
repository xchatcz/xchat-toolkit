/**
 * Jednotná serializovaná fronta pro všechny AJAX/fetch požadavky v Room UI.
 *
 * Pravidlo: **v jednu chvíli je zpracováván maximálně jeden request**.
 * Nové požadavky se řadí do fronty a čekají, až aktuální doběhne.
 * Opakovaný požadavek **nikdy neruší** ten, který už běží.
 *
 * Pro periodické úlohy (texty v místnosti, info řádek, oblíbení online)
 * existuje pomocná metoda {@link RequestQue.every}, která poschovává
 * interval timer, ale neodešle další běh, dokud předchozí ještě běží.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export type RequestTask<T> = () => Promise<T>;

interface QueuedJob<T = unknown> {
  task: RequestTask<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
  label?: string;
}

export class RequestQue {
  private readonly queue: QueuedJob[] = [];
  private busy = false;
  private stopped = false;

  /** Zařadí úlohu do fronty a vrátí promise s jejím výsledkem. */
  enqueue<T>(task: RequestTask<T>, label?: string): Promise<T> {
    if (this.stopped) return Promise.reject(new Error('RequestQue zastavena'));
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject, label } as QueuedJob<T> as QueuedJob);
      void this.drain();
    });
  }

  /** Vyprázdní frontu (běžící úloha doběhne). */
  clear(): void {
    for (const job of this.queue.splice(0)) {
      job.reject(new Error('fronta vyprázdněna'));
    }
  }

  /** Ukončí frontu nadobro. */
  stop(): void {
    this.stopped = true;
    this.clear();
  }

  /**
   * Opakuje úlohu každých `ms` milisekund; pokud předchozí běh ještě
   * probíhá, další se přeskočí (nezahlcuje frontu stejnými úlohami).
   * Vrací funkci pro zastavení.
   */
  every<T>(ms: number, task: RequestTask<T>, label?: string): () => void {
    let running = false;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled || this.stopped) return;
      if (running) return;
      running = true;
      try {
        await this.enqueue(task, label);
      } catch {
        /* chyba je vyřešená uvnitř tasku */
      } finally {
        running = false;
      }
    };
    // První spuštění hned.
    void tick();
    const handle = window.setInterval(tick, ms);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        try {
          const result = await job.task();
          job.resolve(result);
        } catch (err) {
          job.reject(err);
        }
      }
    } finally {
      this.busy = false;
    }
  }
}

/** Sdílená instance – jedna na celou Room aplikaci. */
export const requestQue = new RequestQue();
