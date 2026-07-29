export interface ToolbarCallbacks {
  onHelp(): void;
  onReset(): void;
}

export function createToolbar(callbacks: ToolbarCallbacks): HTMLElement {
  const header = document.createElement("header");
  header.className = "app-toolbar";
  header.innerHTML = `
    <div class="brand" aria-label="Camera Frame">
      <span class="brand-mark" aria-hidden="true">CF</span>
      <span>Camera Frame</span>
    </div>
    <div class="toolbar-actions">
      <button class="icon-button" type="button" data-action="reset" aria-label="恢复默认设置" title="恢复默认设置">↺</button>
      <button class="icon-button" type="button" data-action="help" aria-label="打开帮助" title="帮助">?</button>
    </div>`;
  header.querySelector<HTMLButtonElement>("[data-action='reset']")?.addEventListener("click", callbacks.onReset);
  header.querySelector<HTMLButtonElement>("[data-action='help']")?.addEventListener("click", callbacks.onHelp);
  return header;
}

