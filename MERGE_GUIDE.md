# 🔧 Guía Completa: Meld y Difftool en Scripts de Git

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

### Qué Puedes Hacer (CONTROL TOTAL)
- **Click flecha ←**: Tomar línea de la izquierda
- **Click flecha →**: Tomar línea de la derecha
- **Editar manualmente**: Escribir en el panel central
- **Combinar**: Tomar partes de ambos lados
- **Eliminar**: Borrar líneas completas
- **Añadir**: Escribir código nuevo

### Ejemplo de Conflicto
```python
# IZQUIERDA (tu main)        # DERECHA (upstream)
def calculate_total(items):  def calculate_sum(items):
    total = 0                    result = 0
    for item in items:           for item in items:
        total += item.price          result += item.price
    return total                 return result

# CENTRO (tu decisión final - puedes escribir lo que quieras):
def calculate_total(items):  # ← Mantienes tu nombre
    result = 0               # ← Pero usas su variable
    for item in items:
        result += item.price
    return result            # ← Combinas ambos enfoques
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
# IZQUIERDA (antes)          # DERECHA (después del merge)
import requests             import requests
                           import pandas as pd      # ← Añadido automáticamente

def process_data():        def process_advanced_data():  # ← Renombrado automáticamente
    return []                  return pd.DataFrame([])   # ← Lógica cambiada

DEBUG = False              DEBUG = True             # ← Tu resolución de conflicto
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

# Meld te muestra:
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

# MERGETOOL - Archivo 1: config.py
# IZQUIERDA (main): DEBUG = False
# DERECHA (dev): DEBUG = True
# CENTRO: Decides → DEBUG = False (producción)

# MERGETOOL - Archivo 2: api.py
# IZQUIERDA: def get_users() → return db.users.all()
# DERECHA: def get_users() → return db.users.filter(active=True)
# CENTRO: Combinas → return db.users.filter(active=True).all()

# DIFFTOOL - Revisión completa:
# Ve tus resoluciones + otros 8 archivos que se fusionaron automáticamente
# Todo se ve bien, aceptas el merge
```

### Ejemplo 3: Update Dev (squash con conflictos)
```bash
./update_dev.sh
# Eliges "3) Squash"
# "🚨 Conflictos detectados en el squash merge"

# MERGETOOL resuelve conflictos
# DIFFTOOL muestra el resultado: 15 archivos en un solo commit squash
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
