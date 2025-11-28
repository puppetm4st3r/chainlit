# 🔧 Guía Completa: Meld y Difftool en Scripts de Git

## 🚀 Workflows Rápidos

### 🎯 Flujo de Trabajo Completo (Orden Recomendado)

Cuando tienes cambios locales en `dev` y necesitas sincronizar con upstream:

**1. Commitea tus cambios en dev**
```bash
git add .
git commit -m "Descripción de tus cambios"
```

**2. Cambia a main y sincroniza con upstream**
```bash
git checkout main
./sync_upstream.sh
```
*Esto actualiza tu main con los últimos cambios del repo original de Chainlit*

**3. Integra dev a main (con main ya actualizado)**
```bash
./merge_dev_to_main.sh
```
*Ahora tus cambios de dev se integran sobre un main actualizado*

**¿Por qué en este orden?**
- ✅ **Menos conflictos**: Main actualizado primero = conflictos más simples
- ✅ **Práctica estándar**: Rama principal siempre alineada con upstream
- ✅ **Más seguro**: Si algo falla en sync, dev queda intacto
- ❌ **Evitar**: Mergear dev→main primero y luego hacer sync genera conflictos más complejos

**⚠️ Importante**: Los scripts requieren working directory limpio (sin cambios sin commitear). Si ves el error *"Tienes cambios sin commitear"*, primero haz commit en tu rama actual.

---

### Sincronizar con Repo Original de Chainlit
Para traer los últimos cambios del repositorio upstream de Chainlit a tu repo local:

1. **Ejecuta el script de sync**: `./sync_upstream.sh`
2. **Si hay conflictos**: Meld abrirá **mergetool (3 paneles)** para resolverlos
   - *Izq: tu código | Centro: EDITAS aquí | Der: código upstream*
3. **Revisión obligatoria**: Meld mostrará todos los cambios en **difftool (2 paneles)**
   - *Izq: antes del merge | Der: después del merge (solo lectura)*
4. **Confirma o cancela**: El script te preguntará si proceder con el commit
   - **Si confirmas (y)**: Los cambios de upstream se integran permanentemente a tu rama local. Puedes hacer push para sincronizar con el remoto.
   - **Si cancelas (n)**: Se hace rollback completo, tu rama vuelve al estado anterior al merge. Los cambios de upstream NO se integran. Puedes intentar de nuevo cuando estés listo.

### Mergear Dev a Master (nuestro repo)
Para integrar cambios de la rama `dev` (chainlit) a la rama `master` (chainlit):

1. **Ejecuta el script de merge**: `./merge_dev_to_main.sh`
2. **Si hay conflictos**: Meld abrirá **mergetool (3 paneles)** para resolverlos
   - *Izq: tu master | Centro: EDITAS aquí | Der: código de dev*
3. **Revisión completa**: **Difftool (2 paneles)** te mostrará todos los cambios
   - *Izq: master antes | Der: master después (solo lectura)*
4. **Decide y confirma**: Acepta el merge o cancela si algo no se ve bien
   - **Si confirmas (y)**: Los cambios de dev se integran a master de forma permanente. Tu rama master queda actualizada con las nuevas funcionalidades. Listo para push a remoto.
   - **Si cancelas (n)**: Se revierte todo, master queda intacto como estaba antes. Los cambios de dev NO se integran. Puedes revisar qué salió mal y reintentar el merge cuando resuelvas los problemas.

**💡 Tip**: Ambos scripts crean backups automáticos antes de cualquier operación. Siempre puedes volver atrás si algo sale mal.

---

## 📋 Índice
- [Flujo General](#flujo-general)
- [Mergetool: Resolución de Conflictos](#mergetool-resolución-de-conflictos)
- [Difftool: Revisión Final](#difftool-revisión-final)
- [Códigos de Colores](#códigos-de-colores)
- [Atajos de Teclado](#atajos-de-teclado)
- [Ejemplos Prácticos](#ejemplos-prácticos)
- [Qué Hacer Si...](#qué-hacer-si)

---

## 🔄 Flujo General

### Escenario 1: Sin Conflictos (más común)
```
Script ejecuta merge → ✅ Éxito automático → Difftool (revisión) → Decisión final
```

### Escenario 2: Con Conflictos
```
Script ejecuta merge → ❌ Conflictos → Mergetool (resolver) → Difftool (revisar) → Decisión final
```

---

## ⚔️ Mergetool: Resolución de Conflictos

### Cuándo aparece
- Solo cuando Git no puede fusionar automáticamente
- Archivos donde ambas ramas modificaron las mismas líneas

### Interfaz de 3 Paneles
```
┌─────────────┬─────────────┬─────────────┐
│ IZQUIERDA   │   CENTRO    │  DERECHA    │
│             │             │             │
│ Tu versión  │ RESULTADO   │ Su versión  │
│ (LOCAL)     │ FINAL       │ (REMOTE)    │
│             │ ✏️ EDITABLE │             │
└─────────────┴─────────────┴─────────────┘
```

**Panel IZQUIERDA**: Tu código actual en la rama donde estás (main/master)  
**Panel CENTRO**: El resultado final que se guardará - AQUÍ EDITAS para resolver conflictos  
**Panel DERECHA**: El código que viene de la otra rama (upstream/dev)

### Qué Puedes Hacer (CONTROL TOTAL)
- **Click flecha ←**: Tomar línea de la izquierda
- **Click flecha →**: Tomar línea de la derecha
- **Editar manualmente**: Escribir en el panel central
- **Combinar**: Tomar partes de ambos lados
- **Eliminar**: Borrar líneas completas
- **Añadir**: Escribir código nuevo

### Ejemplo de Conflicto
```python
# ─────────────── PANEL IZQUIERDA (tu main actual) ───────────────
def calculate_total(items):
    total = 0
    for item in items:
        total += item.price
    return total

# ─────────────── PANEL DERECHA (código de upstream/dev) ───────────────
def calculate_sum(items):
    result = 0
    for item in items:
        result += item.price
    return result

# ─────────────── PANEL CENTRO (TU EDITAS AQUÍ - resultado final) ───────────────
def calculate_total(items):  # ← Decides mantener tu nombre de función
    result = 0               # ← Pero tomas su nombre de variable
    for item in items:
        result += item.price
    return result            # ← Combinas lo mejor de ambos
```

### Proceso de Resolución
1. **Revisa cada conflicto** línea por línea
2. **Decide qué código queda** (izquierda, derecha, o combinación)
3. **Guarda** (`Ctrl+S`) después de resolver cada archivo
4. **Cierra** Meld para continuar al siguiente archivo conflictivo
5. **Repite** hasta resolver todos los conflictos

---

## 👁️ Difftool: Revisión Final

### Cuándo aparece
- **SIEMPRE** después de mergetool (o directamente si no hubo conflictos)
- Para revisar **TODOS** los cambios antes del commit final

### Interfaz de 2 Paneles
```
┌─────────────────┬─────────────────┐
│   IZQUIERDA     │    DERECHA      │
│                 │                 │
│ Estado ANTES    │ Estado DESPUÉS  │
│ (main actual)   │ (main fusionado)│
│ 👀 SOLO LECTURA │ 👀 SOLO LECTURA │
└─────────────────┴─────────────────┘
```

**Panel IZQUIERDA**: Tu código ANTES del merge - cómo está ahora tu rama  
**Panel DERECHA**: Tu código DESPUÉS del merge - cómo quedará con todos los cambios integrados  
**Ambos paneles son SOLO LECTURA**: Aquí solo revisas, no editas

### Qué Puedes Hacer (SOLO REVISAR)
- ✅ **Ver** todos los cambios archivo por archivo
- ✅ **Navegar** entre archivos (Meld los abre secuencialmente)
- ✅ **Cerrar** cada archivo para continuar al siguiente
- ✅ **Interrumpir** (cerrar Meld) para salir de la revisión
- ❌ **NO editar** (solo lectura)

### Qué Estás Viendo
- **Cambios automáticos**: Fusiones que Git hizo sin conflictos
- **Tus resoluciones**: Conflictos que resolviste en mergetool
- **Resultado completo**: Cómo quedará tu rama después del merge

### Ejemplo de Revisión
```python
# ─────── PANEL IZQUIERDA (tu código ANTES del merge) ───────
import requests

def process_data():
    return []

DEBUG = False

# ─────── PANEL DERECHA (tu código DESPUÉS del merge) ───────
import requests
import pandas as pd      # ← Añadido automáticamente por el merge

def process_advanced_data():  # ← Función renombrada automáticamente
    return pd.DataFrame([])   # ← Lógica actualizada

DEBUG = True             # ← Tu resolución de conflicto (si hubo)
```

### Proceso de Revisión
1. **Meld abre archivo por archivo** automáticamente
2. **Revisa cada cambio** cuidadosamente
3. **Pregúntate**: "¿Me gusta cómo quedó esto?"
4. **Cierra** el archivo para continuar al siguiente
5. **Si algo no te gusta**: interrumpe y cancela en el script

---

## 🎨 Códigos de Colores

### En Mergetool (3 paneles)
- 🔴 **Rojo**: Líneas en conflicto que debes resolver
- 🔵 **Azul**: Líneas diferentes pero sin conflicto
- 🟢 **Verde**: Líneas añadidas
- ⚪ **Blanco**: Líneas sin cambios

### En Difftool (2 paneles)
- 🟢 **Verde**: Líneas añadidas en la versión nueva
- 🔴 **Rojo**: Líneas eliminadas de la versión anterior
- 🔵 **Azul**: Líneas modificadas
- ⚪ **Blanco**: Líneas sin cambios

---

## ⌨️ Atajos de Teclado

### Navegación
- `Ctrl+D`: Ir al siguiente conflicto/diferencia
- `Ctrl+E`: Ir al conflicto/diferencia anterior
- `F5`: Actualizar comparación

### Edición (solo en Mergetool)
- `Ctrl+S`: Guardar archivo
- `Ctrl+Z`: Deshacer
- `Ctrl+Y`: Rehacer

### General
- `Ctrl+Q`: Cerrar Meld
- `Escape`: Cancelar operación actual

---

## 📚 Ejemplos Prácticos

### Ejemplo 1: Sync Upstream (sin conflictos)
```bash
./sync_upstream.sh
# "📊 Total: 5 archivos modificados en 2 commits"
# "✅ Merge automático exitoso"
# "🔍 REVISIÓN OBLIGATORIA: Abriendo difftool..."

# ═══════════ DIFFTOOL (2 paneles) - Revisión de cambios ═══════════
# PANEL IZQUIERDA (tu main antes):  Tu código actual
# PANEL DERECHA (main después):    Con los cambios de upstream integrados

# Meld te muestra archivo por archivo:
# 1. requirements.txt: numpy==1.21.0 → numpy==1.24.0
# 2. src/api.py: añadieron nueva función authenticate()
# 3. README.md: actualizaron documentación de instalación
# 4. config.py: cambiaron DEFAULT_PORT = 8000 → 3000
# 5. tests/test_main.py: añadieron 3 tests nuevos

# Revisas todo, cierras Meld
# Script pregunta: "🤔 ¿Proceder con el commit? (y/n)"
```

### Ejemplo 2: Merge Dev (con conflictos)
```bash
./merge_dev_to_main.sh
# "🚨 2 archivos con conflictos detectados"
# "🔧 Abriendo Meld para resolver conflictos..."

# ═══════════ MERGETOOL (3 paneles) - Archivo 1: config.py ═══════════
# PANEL IZQUIERDA (tu main):  DEBUG = False
# PANEL DERECHA (dev):        DEBUG = True
# PANEL CENTRO (TU EDITAS):   DEBUG = False  ← Decides dejar prod

# ═══════════ MERGETOOL (3 paneles) - Archivo 2: api.py ═══════════
# PANEL IZQUIERDA:  def get_users() → return db.users.all()
# PANEL DERECHA:    def get_users() → return db.users.filter(active=True)
# PANEL CENTRO:     def get_users() → return db.users.filter(active=True).all()
#                   ↑ Combinas ambas versiones

# ═══════════ DIFFTOOL (2 paneles) - Revisión completa ═══════════
# PANEL IZQUIERDA (antes):  Tu main sin cambios
# PANEL DERECHA (después):  Tus 2 resoluciones + 8 archivos mergeados automáticamente
# Todo se ve bien, aceptas el merge
```

### Ejemplo 3: Update Dev (squash con conflictos)
```bash
./update_dev.sh
# Eliges "3) Squash"
# "🚨 Conflictos detectados en el squash merge"

# ═══════════ MERGETOOL (3 paneles) - Resuelves conflictos ═══════════
# PANEL IZQUIERDA: Tu código en dev
# PANEL CENTRO: Editas y resuelves los conflictos
# PANEL DERECHA: Código que viene de main

# ═══════════ DIFFTOOL (2 paneles) - Revisión final ═══════════
# PANEL IZQUIERDA (antes): Dev sin los cambios de main
# PANEL DERECHA (después): Dev con 15 archivos actualizados en un squash
# Escribes mensaje: "Sync with main: auth improvements and bug fixes"
```

---

## 🆘 Qué Hacer Si...

### ❓ "No entiendo un conflicto"
1. **Lee el contexto** alrededor de las líneas en conflicto
2. **Busca comentarios** o nombres de funciones para entender qué hace
3. **En caso de duda**: toma la versión más conservadora (generalmente la izquierda)
4. **Siempre puedes cancelar** el merge completo si no estás seguro

### ❓ "Meld se cerró inesperadamente"
1. **No te preocupes**: Git mantiene el estado
2. **Ejecuta manualmente**: `git mergetool` para continuar resolviendo
3. **O cancela**: `git merge --abort` y empieza de nuevo

### ❓ "En difftool veo cambios que no me gustan"
1. **Cierra Meld** (interrumpe la revisión)
2. **Cuando el script pregunte**: responde `n` (no proceder)
3. **El script cancela todo** y restaura el estado anterior
4. **Puedes intentar de nuevo** con diferentes resoluciones

### ❓ "Guardé mal un conflicto en mergetool"
1. **Mientras esté abierto**: `Ctrl+Z` para deshacer
2. **Si ya cerraste**: cancela el merge completo y empieza de nuevo
3. **Comando para cancelar**: El script te restaura automáticamente si dices `n`

### ❓ "Hay demasiados archivos para revisar"
1. **Es normal**: upstream puede tener muchos cambios
2. **Revisa los importantes**: archivos de configuración, código principal
3. **Los demás**: dale un vistazo rápido (documentación, tests)
4. **Si hay demasiados**: considera hacer el sync en partes más pequeñas

### ❓ "No sé si un cambio automático es correcto"
1. **Lee el contexto**: función completa, imports relacionados
2. **Busca patrones**: ¿cambió solo el nombre o también la lógica?
3. **En caso de duda**: cancela y revisa manualmente con `git log`
4. **Consulta**: busca el commit original en GitHub/GitLab

---

## 🎯 Consejos Finales

### ✅ Buenas Prácticas
- **Tómate tu tiempo**: mejor revisar bien que arreglar después
- **Lee el contexto completo**: no solo las líneas marcadas
- **Guarda frecuentemente**: `Ctrl+S` después de cada resolución
- **Usa nombres descriptivos**: en commits squash, explica qué cambió

### ❌ Errores Comunes
- **No revisar cambios automáticos**: pueden ser importantes
- **Aceptar todo sin leer**: el punto es validar conscientemente
- **Cerrar sin guardar**: pierdes tus resoluciones
- **Tener miedo de cancelar**: siempre puedes volver atrás

### 🚀 Flujo Recomendado
1. **Ejecuta el script** con tiempo suficiente
2. **En mergetool**: resuelve conflictos pensando cada línea
3. **En difftool**: revisa TODO el resultado final
4. **Solo acepta** si estás 100% convencido
5. **Si dudas**: cancela y consulta/investiga más

---

## 📞 Comandos de Emergencia

Si algo sale mal y necesitas salir manualmente:

```bash
# Cancelar merge en progreso
git merge --abort

# Ver estado actual
git status

# Volver a rama de backup (los scripts las crean automáticamente)
git branch -a | grep backup
git checkout backup/nombre-del-backup

# Limpiar archivos temporales
find . -name "*.orig" -delete
```

---

**💡 Recuerda**: Los scripts siempre crean backups automáticos. Si algo sale mal, puedes volver atrás sin problemas. ¡La seguridad es lo primero!
