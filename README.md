# Textastic

Editor de código inspirado en Textastic con integración GitHub. Construido con React 19, Vite, TypeScript, Monaco Editor e isomorphic-git.

![Textastic](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Monaco](https://img.shields.io/badge/Monaco%20Editor-Latest-blue)

## Características

- **Editor Monaco** con multi-tabs, syntax highlighting automático y tema dark
- **File Tree** recursivo con navegación de carpetas
- **Virtual File System** usando LightningFS (persiste en IndexedDB)
- **Integración Git** completa: clone, commit, push, pull
- **Autenticación OAuth** con GitHub usando PKCE (seguro, sin client_secret en frontend)
- **Vista previa** de archivos HTML/CSS/JS en iframe
- **Layout split** con paneles redimensionables

## Requisitos previos

- Node.js 20+
- npm o yarn
- Una cuenta de GitHub
- Un Cloudflare Worker (o similar) para el intercambio de tokens OAuth

## Instalación

```bash
# Clonar o descargar el proyecto
cd textastic

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Configuración de OAuth con GitHub

Para usar la integración con GitHub, necesitas configurar una OAuth App:

### 1. Crear OAuth App en GitHub

1. Ve a [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Haz clic en **"New OAuth App"**
3. Completa los campos:
   - **Application name**: Textastic (o el nombre que prefieras)
   - **Homepage URL**: `http://localhost:5173` (para desarrollo local)
   - **Application description**: (opcional) Editor de código con integración GitHub
   - **Authorization callback URL**: `http://localhost:5173/callback`
4. Desmarca **"Enable Device Flow"** (no es necesario)
5. Haz clic en **"Register application"**
6. Copia el **Client ID** (lo necesitarás en el paso 2)

### 2. Crear Client Secret

1. En la página de tu OAuth App, haz clic en **"Generate a new client secret"**
2. Copia el **Client Secret** (¡solo se muestra una vez!)
3. Guárdalo de forma segura, lo necesitarás para el worker

### 3. Configurar el Worker de Intercambio

Por seguridad, el intercambio de código por token debe hacerse en un backend seguro. Aquí hay un ejemplo usando **Cloudflare Workers**:

```javascript
// worker.js - Cloudflare Worker para intercambio OAuth

export default {
  async fetch(request, env, ctx) {
    // Configurar CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Manejar preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Solo aceptar POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders,
      });
    }
    
    try {
      const { code, code_verifier } = await request.json();
      
      if (!code || !code_verifier) {
        return new Response(
          JSON.stringify({ error: 'Missing code or code_verifier' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Intercambiar código por token con GitHub
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
          code_verifier: code_verifier,
        }),
      });
      
      const tokenData = await tokenResponse.json();
      
      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Internal server error', message: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  },
};
```

#### Variables de entorno del Worker:

```bash
GITHUB_CLIENT_ID=tu_client_id_aqui
GITHUB_CLIENT_SECRET=tu_client_secret_aqui
```

#### Desplegar el worker:

```bash
# Instalar wrangler
npm install -g wrangler

# Login en Cloudflare
wrangler login

# Crear proyecto
wrangler init github-oauth-worker

# Editar wrangler.toml y agregar:
# [vars]
# GITHUB_CLIENT_ID = "tu_client_id"
# [secrets]
# GITHUB_CLIENT_SECRET

# Desplegar
wrangler deploy
```

### 4. Configurar la Aplicación

Edita el archivo `src/utils/oauth.ts` y reemplaza los placeholders:

```typescript
// Línea 52 - REEMPLAZA CON TU CLIENT ID
const CLIENT_ID = 'tu_client_id_aqui';

// Línea 57 - REEMPLAZA CON TU URL DE REDIRECCIÓN
const REDIRECT_URI = 'http://localhost:5173/callback';

// Línea 62 - REEMPLAZA CON LA URL DE TU WORKER
const WORKER_EXCHANGE_URL = 'https://tu-worker.tu-subdomain.workers.dev';
```

## Estructura del Proyecto

```
textastic/
├── src/
│   ├── components/
│   │   ├── EditorPane.tsx      # Editor Monaco con tabs
│   │   ├── FileTree.tsx        # Árbol de archivos recursivo
│   │   └── PreviewPane.tsx     # Vista previa HTML/JS/CSS
│   ├── utils/
│   │   ├── fs.ts               # Virtual filesystem (LightningFS)
│   │   ├── git.ts              # Operaciones Git (isomorphic-git)
│   │   └── oauth.ts            # Autenticación OAuth con PKCE
│   ├── types/
│   │   └── index.ts            # Tipos TypeScript
│   ├── App.tsx                 # Componente principal con layout
│   ├── main.tsx                # Entry point
│   └── index.css               # Estilos globales
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Uso

### Clonar un repositorio

1. Ingresa la URL del repositorio en el campo de texto del header
2. Haz clic en **"Clone"**
3. Si el repositorio es privado, primero inicia sesión con GitHub

### Editar archivos

1. Haz clic en cualquier archivo en el árbol de archivos (sidebar izquierda)
2. El archivo se abrirá en un nuevo tab en el editor
3. Los cambios se indican con un `*` en el tab
4. Usa **Ctrl+S** o el botón **"Save"** para guardar

### Commit y Push

1. Realiza tus cambios y guárdalos
2. Haz clic en **"Commit"** para crear un commit local
3. Haz clic en **"Push"** para subir los cambios a GitHub

### Vista previa

- Los archivos HTML se renderizan automáticamente en el panel derecho
- Usa el botón de recargar para actualizar la vista previa
- Los archivos CSS/JS se muestran con información del archivo

## Seguridad

- **NUNCA** expongas el `client_secret` en el código frontend
- El flujo OAuth usa **PKCE** para protección adicional
- El `state` se valida para prevenir ataques CSRF
- Los tokens se almacenan en `localStorage` (considera usar un método más seguro en producción)

## Scripts disponibles

```bash
npm run dev      # Iniciar servidor de desarrollo
npm run build    # Compilar para producción
npm run preview  # Previsualizar build de producción
npm run lint     # Ejecutar ESLint
```

## Tecnologías utilizadas

- **React 19** - UI library
- **Vite** - Build tool
- **TypeScript** - Tipado estático
- **Monaco Editor** - Editor de código (el mismo de VS Code)
- **Tailwind CSS** - Estilos
- **shadcn/ui** - Componentes UI
- **isomorphic-git** - Operaciones Git en el navegador
- **LightningFS** - File system virtual
- **react-resizable-panels** - Layout split
- **pkce-challenge** - Generación de PKCE para OAuth

## Licencia

MIT

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

---

**Nota**: Este proyecto es un ejemplo educativo. En producción, considera agregar manejo de errores más robusto, tests, y medidas de seguridad adicionales.
