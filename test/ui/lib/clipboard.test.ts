// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../../../src/ui/lib/clipboard';

describe('copyToClipboard', () => {
  beforeEach(() => {
    // jsdom não implementa execCommand em tempo de execução (mesmo o tipo do
    // DOM declarando o método) — sem isso, vi.spyOn(document, 'execCommand')
    // falha por não haver função nenhuma ali pra espionar.
    document.execCommand = (() => false) as typeof document.execCommand;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('usa navigator.clipboard.writeText quando disponível (contexto seguro)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const ok = await copyToClipboard('senha-ficticia');

    expect(writeText).toHaveBeenCalledWith('senha-ficticia');
    expect(ok).toBe(true);
  });

  it('cai para document.execCommand quando navigator.clipboard não existe (contexto não seguro)', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const ok = await copyToClipboard('senha-ficticia');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
  });

  it('cai para document.execCommand quando navigator.clipboard.writeText rejeita', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('negado'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const ok = await copyToClipboard('senha-ficticia');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
  });

  it('devolve false se nem o método legado funcionar', async () => {
    vi.stubGlobal('navigator', {});
    vi.spyOn(document, 'execCommand').mockReturnValue(false);

    const ok = await copyToClipboard('senha-ficticia');

    expect(ok).toBe(false);
  });

  it('remove o textarea temporário do DOM depois de copiar pelo método legado', async () => {
    vi.stubGlobal('navigator', {});
    vi.spyOn(document, 'execCommand').mockReturnValue(true);

    await copyToClipboard('senha-ficticia');

    expect(document.querySelector('textarea')).toBeNull();
  });
});
