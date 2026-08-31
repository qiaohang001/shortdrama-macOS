/**
 * 打开外部链接（用 Tauri shell.open，桌面应用最可靠）
 * @param {string} url - 要打开的URL
 */
export async function openExternalUrl(url) {
  try {
    // 优先用 Tauri shell.open（桌面应用）
    const shell = await import('@tauri-apps/plugin-shell');
    if (shell && shell.open) {
      await shell.open(url);
      return true;
    }
  } catch (e) {
    console.log("Tauri shell不可用，降级到window.open:", e.message);
  }
  
  // 降级：浏览器方式
  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch (e) {
    console.error("打开外部链接失败:", e);
    window.location.href = url;
    return false;
  }
}

/**
 * 打开官网购买页面
 * @param {string} type - 购买类型：recharge（充值）/ membership（会员）
 */
export async function openPurchasePage(type = "recharge") {
  const baseUrl = "https://www.jinsuai.cn";
  const token = localStorage.getItem("DISPATCH_TOKEN") || "";
  const username = localStorage.getItem("DISPATCH_USERNAME") || "";
  
  let url = `${baseUrl}/#pricing`;
  if (token) {
    url += `?token=${encodeURIComponent(token)}`;
  }
  if (username) {
    url += `&username=${encodeURIComponent(username)}`;
  }
  
  return await openExternalUrl(url);
}
