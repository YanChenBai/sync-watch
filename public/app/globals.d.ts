declare module '*.css';

/*
 * File System Access API 与 webkit 全屏 / AirPlay 等尚未进入所有
 * TypeScript DOM lib 版本，这里补充最小可用声明。
 */

interface FileSystemFileHandle {
  getFile(): Promise<File>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }): Promise<FileSystemDirectoryHandle>;
}

interface HTMLVideoElement {
  /** iOS Safari：视频元素专属的全屏入口。 */
  webkitEnterFullscreen?: () => void;

  webkitExitFullscreen?: () => void;

  readonly webkitDisplayingFullscreen?: boolean;

  /** Safari 的 AirPlay 设备选择器。 */
  webkitShowPlaybackTargetPicker?: () => void;
}
