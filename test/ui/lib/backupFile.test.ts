// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareOrDownloadBackup, readFileAsBytes } from '../../../src/ui/lib/backupFile';

describe('shareOrDownloadBackup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('usa navigator.share com o arquivo quando disponível (contexto seguro)', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, share, canShare });

    const resultado = await shareOrDownloadBackup(new Uint8Array([1, 2, 3]));

    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledTimes(1);
    const argumento = share.mock.calls[0]![0];
    expect(argumento.files).toHaveLength(1);
    expect(argumento.files[0].name).toMatch(/^cofre-pessoal-backup-\d{4}-\d{2}-\d{2}\.cofre$/);
    expect(resultado).toBe('compartilhado');
  });

  it('usuário cancelando a folha de compartilhamento (AbortError) conta como sucesso, não erro', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('cancelado'), { name: 'AbortError' }));
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, share, canShare });

    const resultado = await shareOrDownloadBackup(new Uint8Array([1, 2, 3]));

    expect(resultado).toBe('compartilhado');
  });

  it('cai para link de download quando navigator.share não existe (contexto não seguro)', async () => {
    vi.stubGlobal('navigator', Object.fromEntries(Object.entries(navigator).filter(([k]) => k !== 'share' && k !== 'canShare')));
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:ficticio'), revokeObjectURL: vi.fn() });
    const cliqueSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const resultado = await shareOrDownloadBackup(new Uint8Array([1, 2, 3]));

    expect(resultado).toBe('baixado');
    expect(cliqueSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull(); // removido do DOM depois do clique
  });

  it('cai para link de download quando navigator.share existe mas canShare recusa o arquivo', async () => {
    const share = vi.fn();
    const canShare = vi.fn().mockReturnValue(false);
    vi.stubGlobal('navigator', { ...navigator, share, canShare });
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:ficticio'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const resultado = await shareOrDownloadBackup(new Uint8Array([1, 2, 3]));

    expect(share).not.toHaveBeenCalled();
    expect(resultado).toBe('baixado');
  });
});

describe('readFileAsBytes', () => {
  it('lê o conteúdo de um File como Uint8Array', async () => {
    const file = new File([new Uint8Array([10, 20, 30])], 'backup.cofre');

    const bytes = await readFileAsBytes(file);

    expect(Array.from(bytes)).toEqual([10, 20, 30]);
  });
});
