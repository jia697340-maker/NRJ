import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nianrenjin.app',
  appName: '粘人精',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
}

export default config
