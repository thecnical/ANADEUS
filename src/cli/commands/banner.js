import { displayBanner, displaySystemStatus } from "../../ui/banner.js";

export async function runBannerMode() {
  await displayBanner({ animate: false, blinkStatus: false });
  displaySystemStatus();
}
