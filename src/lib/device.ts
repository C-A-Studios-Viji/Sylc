export function getDeviceLabel(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? 'Unknown device'
  return `${platform} · ${new Date().toLocaleDateString()}`
}
