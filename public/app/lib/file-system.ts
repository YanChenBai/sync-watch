import type { Playlist } from '../types.ts';

const PLAYLIST_FILE = 'playlist.json';

export function supportsDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

/**
 * 让用户选择存放 `playlist.json` 的目录。
 *
 * @returns 用户取消时返回 `null`。
 */
export async function pickLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) {
    throw new Error('当前浏览器不支持选择文件夹，请使用桌面版 Chrome / Edge');
  }

  try {
    return await window.showDirectoryPicker({
      id: 'sync-watch-library',
      mode: 'read',
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      return null;
    }

    throw cause;
  }
}

export async function readPlaylist(directory: FileSystemDirectoryHandle): Promise<Playlist> {
  const handle = await directory.getFileHandle(PLAYLIST_FILE);
  const file = await handle.getFile();
  const data = JSON.parse(await file.text()) as Playlist;

  validatePlaylist(data);

  return data;
}

function validatePlaylist(data: Playlist): void {
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    throw new Error('playlist.json 中没有 items');
  }

  for (const item of data.items) {
    if (typeof item?.title !== 'string' || typeof item?.src !== 'string') {
      throw new Error('playlist item 必须包含 title 和 src');
    }
  }
}

/** 把 playlist 中的相对路径安全地解析成目录下的文件。 */
export async function resolveFile(root: FileSystemDirectoryHandle, path: string): Promise<File> {
  const parts = path
    .replaceAll('\\', '/')
    .split('/')
    .filter(part => part !== '' && part !== '.');

  if (parts.length === 0) {
    throw new Error(`Invalid path: ${path}`);
  }

  if (parts.includes('..')) {
    throw new Error('playlist.json 不允许访问父目录');
  }

  let directory = root;

  for (const part of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(part);
  }

  const handle = await directory.getFileHandle(parts[parts.length - 1]);

  return handle.getFile();
}
