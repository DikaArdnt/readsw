Saya cuman meng akali saja agar react sw nya tidak terjadi bug


Tinggal `npm install` terus `npm start`


## Info

Tidak disarnakan untuk digunakan secara publik, karena seiring berjalannya waktu penggunaan RAM semakin besar.

Untuk mengurangi penggunaan RAM bisa dimatikan write store di `.env`

Saran untuk membuat akun github tumbal jika ingin run di github action

```
Terimakasih kepada dikaardnt/hisoka(sc ori/base) dan danz(function react sw)
```


## Jika ingin run sc di github act
```
# Ingat untuk membuat akun github tumbal agar terhindar dari akun terbanned
name: Run WhatsApp Bot

on:
  push:
    branches:
      - apaaja # sesuai kan dengan branch repo mu
  schedule:
    - cron: '0 */5 * * *'  # Setiap 5 jam

concurrency:
  group: 'whatsapp-bot'
  cancel-in-progress: true

jobs:
  run-whatsapp-bot:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'

      - name: Install ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Install dependencies
        run: npm install

      - name: Start WhatsApp Bot
        run: npm start
```
