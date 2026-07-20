## Webhook مع ngrok (بلا Deploy)

### 1. حمل ngrok
https://ngrok.com/download — مجاني، بلا تسجيل للاستعمال المؤقت

### 2. شغل السيرفر
```
cd backend
npm start
```

### 3. في terminal ثاني، شغل ngrok
```
ngrok http 3001
```

سيعطيك URL كـ هدا:
```
Forwarding  https://abc123.ngrok-free.app → http://localhost:3001
```

### 4. الـ URL هداك حطه فـ Meta Dashboard
WhatsApp → Configuration → Callback URL:
```
https://abc123.ngrok-free.app/webhook
```

Verify Token: نفس اللي فـ .env → WHATSAPP_VERIFY_TOKEN

### ⚠️ ملاحظة
- الـ URL كيتبدل كل مرة تشغل ngrok (Free plan)
- غير للتطوير والتجربة، مو للإنتاج
