
# Gemini Tutor AI

An AI-powered homework assistant — point your camera, use your voice, or type to learn interactively with an AI tutor built on Google Gemini.

![React](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-cyan) ![Express](https://img.shields.io/badge/Express-4-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue) ![Cloud Run](https://img.shields.io/badge/Google_Cloud-Run-orange)

---


## English

### Overview

Gemini Tutor is a full-stack web application that acts as a patient AI tutor. It helps students understand problems step by step, without giving direct answers — encouraging them to discover solutions on their own. Features include:

- **Camera Vision** — point your camera at your homework and get guidance
- **Voice Chat** — talk to the tutor using your microphone
- **Text Chat** — classic text conversation with image upload support
- **Multilingual** — responds in the same language the student uses


### Tech Stack

| Layer     | Technology                                                                 |
|-----------|----------------------------------------------------------------------------|
| Frontend  | React 19, Vite 6, Tailwind CSS 4, Lucide Icons, Motion                      |
| Backend   | Node.js, Express 4, TypeScript, tsx                                         |
| AI        | Google Gemini (`gemini-3.1-flash-lite-preview`) via Vertex AI or `@google/genai` |
| Deploy    | Docker, Google Cloud Run, Cloud Build                                       |


### Project Structure

```text
Gemini-Tutor-AI/
├── src/
│   ├── App.tsx              # Main app (Welcome screen, Chat, Camera, Voice)
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles (Tailwind)
├── server/
│   ├── index.ts             # Express server (API routes + static serving)
│   ├── package.json
│   └── tsconfig.json
├── package.json             # Frontend dependencies & scripts
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # Frontend TypeScript config
├── Dockerfile               # Multi-stage build (frontend + backend)
├── deploy.sh                # One-command deploy to Google Cloud Run
└── README.md
```


### Prerequisites

- Node.js 18+
- npm 9+
- A Gemini API key ([get one here](https://aistudio.google.com/apikey)) **or** a Google Cloud project with Vertex AI enabled


### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Gemini-Tutor-AI

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```


### Environment Variables


Create a `.env` file in the project root:

```env
# Option A: Local development with API key
GEMINI_API_KEY=your_gemini_api_key_here

# Option B: Google Cloud Vertex AI (used when deployed)
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
```


> The backend tries Vertex AI first (if `GOOGLE_CLOUD_PROJECT` is set), otherwise falls back to the API key.


### Run in Development


Open two terminals:

```bash
# Terminal 1 — Frontend (Vite dev server on port 3000)
npm run dev
```

```bash
# Terminal 2 — Backend (auto-reload with tsx)
cd server
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`


### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check (returns status, mode, timestamp) |
| `POST` | `/api/chat` | Send a message (with optional `image` base64 and `history` array) |
| `POST` | `/api/analyze` | Send a homework image for analysis |


#### Example: `/api/chat`

```json
POST /api/chat
{
  "message": "How do I solve this equation?",
  "image": "<base64-encoded-jpeg>",
  "history": [
    { "role": "user", "text": "Hi!" },
    { "role": "assistant", "text": "Hello! How can I help?" }
  ]
}
```


### Build for Production

```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build

# Start production server (serves frontend + API)
cd server
npm run start
```


### Deploy to Google Cloud Run

Prerequisites:
1. Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Authenticate: `gcloud auth login`
3. Set your project: `gcloud config set project YOUR_PROJECT_ID`

Then run:

```bash
chmod +x deploy.sh
./deploy.sh
```

This will:
1. Enable required GCP APIs (Cloud Run, Cloud Build, Vertex AI)
2. Build a Docker container via Cloud Build
3. Deploy to Cloud Run (512Mi RAM, 1 CPU, 0–3 instances)
4. Print the live URL


### Available Scripts


#### Frontend (root)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite --port=3000 --host=0.0.0.0` | Start Vite dev server |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Preview production build |
| `clean` | `rm -rf dist` | Remove build output |
| `lint` | `tsc --noEmit` | TypeScript type checking |


#### Backend (`server/`)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch index.ts` | Dev server with auto-reload |
| `build` | `tsc` | Compile TypeScript |
| `start` | `node dist/index.js` | Run compiled server |


---


## Português

### Visão Geral

O Gemini Tutor é uma aplicação web full-stack que funciona como um tutor de IA paciente. Ajuda estudantes a compreender problemas passo a passo, sem dar respostas diretas — incentivando-os a descobrir as soluções por conta própria. Suporta:

- **Visão por Câmera** — aponte a câmera para o dever de casa e receba orientação
- **Chat por Voz** — fale com o tutor usando o microfone
- **Chat por Texto** — conversa clássica por texto com suporte a upload de imagens
- **Multilíngue** — responde no mesmo idioma que o estudante utiliza


### Stack Tecnológica

| Camada   | Tecnologia                                                                 |
|----------|----------------------------------------------------------------------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Lucide Icons, Motion                      |
| Backend  | Node.js, Express 4, TypeScript, tsx                                         |
| IA       | Google Gemini (`gemini-3.1-flash-lite-preview`) via Vertex AI ou `@google/genai` |
| Deploy   | Docker, Google Cloud Run, Cloud Build                                       |


### Estrutura do Projeto

```text
Gemini-Tutor-AI/
├── src/
│   ├── App.tsx              # App principal (Ecrã de boas-vindas, Chat, Câmara, Voz)
│   ├── main.tsx             # Entry point React
│   └── index.css            # Estilos globais (Tailwind)
├── server/
│   ├── index.ts             # Servidor Express (rotas API + ficheiros estáticos)
│   ├── package.json
│   └── tsconfig.json
├── package.json             # Dependências e scripts do frontend
├── vite.config.ts           # Configuração do Vite
├── tsconfig.json            # Config TypeScript do frontend
├── Dockerfile               # Build multi-stage (frontend + backend)
├── deploy.sh                # Deploy com um comando para Google Cloud Run
└── README.md
```


### Pré-requisitos

- Node.js 18+
- npm 9+
- Uma chave de API do Gemini ([obtenha aqui](https://aistudio.google.com/apikey)) **ou** um projeto Google Cloud com Vertex AI ativado


### Instalação

```bash
# Clonar o repositório
git clone <url-do-repo>
cd Gemini-Tutor-AI

# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd server
npm install
```


### Variáveis de Ambiente


Crie um arquivo `.env` na raiz do projeto:

```env
# Opção A: Desenvolvimento local com chave de API
GEMINI_API_KEY=sua_chave_api_gemini_aqui

# Opção B: Google Cloud Vertex AI (usado em produção)
GOOGLE_CLOUD_PROJECT=seu_project_id
GOOGLE_CLOUD_LOCATION=us-central1
```


> O backend tenta Vertex AI primeiro (se `GOOGLE_CLOUD_PROJECT` estiver definido), caso contrário usa a chave de API.


### Executar em Desenvolvimento


Abra dois terminais:

```bash
# Terminal 1 — Frontend (servidor Vite na porta 3000)
npm run dev
```

```bash
# Terminal 2 — Backend (auto-reload com tsx)
cd server
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`


### Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check (devolve status, modo, timestamp) |
| `POST` | `/api/chat` | Enviar mensagem (com `image` base64 e `history` opcionais) |
| `POST` | `/api/analyze` | Enviar imagem de trabalho de casa para análise |


#### Exemplo: `/api/chat`

```json
POST /api/chat
{
  "message": "Como resolvo esta equação?",
  "image": "<jpeg-codificado-em-base64>",
  "history": [
    { "role": "user", "text": "Olá!" },
    { "role": "assistant", "text": "Olá! Como posso ajudar?" }
  ]
}
```


### Build para Produção

```bash
# Build do frontend
npm run build

# Build do backend
cd server
npm run build

# Iniciar servidor de produção (serve frontend + API)
cd server
npm run start
```


### Deploy no Google Cloud Run


Pré-requisitos:
1. Instale o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Autentique-se: `gcloud auth login`
3. Defina o projeto: `gcloud config set project SEU_PROJECT_ID`

Depois execute:

```bash
chmod +x deploy.sh
./deploy.sh
```


Isso irá:
1. Ativar as APIs necessárias do GCP (Cloud Run, Cloud Build, Vertex AI)
2. Construir um container Docker via Cloud Build
3. Fazer deploy no Cloud Run (512Mi RAM, 1 CPU, 0–3 instâncias)
4. Exibir o URL em produção


### Scripts Disponíveis


#### Frontend (raiz)

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `vite --port=3000 --host=0.0.0.0` | Iniciar servidor Vite |
| `build` | `vite build` | Build de produção |
| `preview` | `vite preview` | Pré-visualizar build |
| `clean` | `rm -rf dist` | Remover output de build |
| `lint` | `tsc --noEmit` | Verificação de tipos TypeScript |


#### Backend (`server/`)

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `tsx watch index.ts` | Servidor dev com auto-reload |
| `build` | `tsc` | Compilar TypeScript |
| `start` | `node dist/index.js` | Executar servidor compilado |