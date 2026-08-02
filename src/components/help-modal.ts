export function createHelpModal(): { element: HTMLDialogElement; open(): void } {
  const dialog = document.createElement("dialog");
  dialog.className = "help-dialog";
  dialog.innerHTML = `
    <form method="dialog">
      <div class="dialog-heading"><h2>使用帮助</h2><button class="icon-button" value="close" aria-label="关闭帮助">×</button></div>
      <ol>
        <li>选择或拖入一张照片，应用会在本机提取综合色。</li>
        <li>在“版式”中选择上下结构（横图）或左右结构（标准 2:3 竖图）；左右模式为 1280×1920 照片在左、侧转相机在右。</li>
        <li>在“相机模板”中可选择 Ricoh GR II、Sony A7C II、Nikon Zf、SIGMA BF 或 LUMIX S1RM2；每款都使用独立机身、阴影和液晶屏坐标。</li>
        <li>点候选色或手动选色；默认“纯色全替换”会明显替换整个上方背景。</li>
        <li>开启构图编辑后，可在预览上拖动、双指缩放；可同步液晶屏与大图构图。</li>
        <li>保存 JPG/PNG，或用系统分享面板发送到“照片”等应用。</li>
      </ol>
      <p class="privacy-copy"><strong>隐私说明：</strong>所有照片与合成都只在当前 Safari 页面内处理，不会上传到服务器，也没有分析统计。</p>
      <p>首次打开后可在 Safari 的“分享”菜单中选择“添加到主屏幕”，之后可离线使用。</p>
      <button class="button button-primary dialog-close" value="close">知道了</button>
    </form>`;
  return {
    element: dialog,
    open() {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    },
  };
}
