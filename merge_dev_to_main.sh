#!/bin/bash

# Script para llevar cambios de dev a main con revisión controlada
# Uso: ./merge_dev_to_main.sh
# Ejecutar DESPUÉS de sync_upstream.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

CURRENT_BRANCH=$(git branch --show-current)
BACKUP_BRANCH="backup/main-before-dev-merge-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}🔄 Iniciando merge controlado dev → main${NC}"
echo -e "${BLUE}📍 Rama actual: $CURRENT_BRANCH${NC}"

# 1. Verificar que estamos en un estado limpio
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ ERROR: Tienes cambios sin commitear${NC}"
    echo "Por favor, commitea o guarda tus cambios antes de continuar"
    exit 1
fi

# 2. Verificar que main está actualizado con upstream
echo -e "${BLUE}🔍 Verificando que main esté actualizado con upstream...${NC}"
git fetch upstream
UPSTREAM_COMMITS=$(git rev-list --count main..upstream/main)
if [[ $UPSTREAM_COMMITS -gt 0 ]]; then
    echo -e "${RED}⚠️  ADVERTENCIA: main no está actualizado con upstream${NC}"
    echo -e "${YELLOW}Ejecuta primero: ./sync_upstream.sh${NC}"
    exit 1
fi

# 3. Analizar cambios entre main y dev
echo -e "${BLUE}📊 Analizando diferencias entre main y dev...${NC}"
TOTAL_CHANGES=$(git diff main..dev --name-only | wc -l)
REAL_CHANGES=$(git diff main...dev --name-only --no-merges | wc -l)

echo -e "${CYAN}📋 Total archivos diferentes: $TOTAL_CHANGES${NC}"
echo -e "${CYAN}📋 Archivos realmente modificados por ti: $REAL_CHANGES${NC}"

if [[ $REAL_CHANGES -eq 0 ]]; then
    echo -e "${GREEN}✅ No hay cambios propios para mergear${NC}"
    exit 0
fi

# 4. Mostrar resumen de tus cambios
echo -e "${BLUE}📝 Tus archivos modificados:${NC}"
git diff main...dev --name-only --no-merges | head -15
if [[ $REAL_CHANGES -gt 15 ]]; then
    echo -e "${CYAN}... y $(($REAL_CHANGES - 15)) archivos más${NC}"
fi

# 5. Crear backup de main
echo -e "${YELLOW}💾 Creando backup de main: $BACKUP_BRANCH${NC}"
git checkout main
git checkout -b "$BACKUP_BRANCH"
git checkout main

# 6. Hacer merge sin commit
echo -e "${BLUE}🔄 Iniciando merge dev → main (sin commit)...${NC}"
if git merge dev --no-commit --no-ff; then
    echo -e "${GREEN}✅ Merge automático exitoso${NC}"
    HAS_CONFLICTS=false
else
    echo -e "${YELLOW}⚠️  Detectados conflictos - se requiere resolución manual${NC}"
    HAS_CONFLICTS=true
fi

# 7. Resolver conflictos si existen
if [[ "$HAS_CONFLICTS" == "true" ]]; then
    CONFLICT_FILES=$(git diff --name-only --diff-filter=U | wc -l)
    echo -e "${RED}🚨 $CONFLICT_FILES archivos con conflictos detectados${NC}"
    
    echo -e "${BLUE}📋 Archivos en conflicto:${NC}"
    git diff --name-only --diff-filter=U
    
    echo ""
    echo -e "${YELLOW}🔧 Abriendo Meld para resolver conflictos...${NC}"
    echo -e "${YELLOW}Resuelve cada conflicto y guarda los archivos${NC}"
    
    # Configurar merge tool si no está configurado
    git config merge.tool meld 2>/dev/null || true
    git config diff.tool meld 2>/dev/null || true
    git config difftool.prompt false 2>/dev/null || true
    
    if ! git mergetool; then
        echo -e "${RED}❌ Error en resolución de conflictos${NC}"
        echo -e "${BLUE}💾 Backup disponible en: $BACKUP_BRANCH${NC}"
        exit 1
    fi
    
    # Limpiar archivos .orig
    find . -name "*.orig" -delete 2>/dev/null || true
    
    echo -e "${GREEN}✅ Conflictos resueltos${NC}"
fi

# 8. Revisar todos los cambios con difftool
echo ""
echo -e "${CYAN}🔍 REVISIÓN OBLIGATORIA: Abriendo difftool para todos los cambios${NC}"
echo -e "${CYAN}📝 Revisa cada archivo y ajusta lo que necesites${NC}"
echo -e "${CYAN}💡 Lado izquierdo: estado actual de main${NC}"
echo -e "${CYAN}💡 Lado derecho: cómo quedará después del merge${NC}"

# Configurar diff tool
git config diff.tool meld 2>/dev/null || true
git config difftool.prompt false 2>/dev/null || true

if ! git difftool --staged; then
    echo -e "${YELLOW}⚠️  Difftool interrumpido por el usuario${NC}"
fi

# 9. Mostrar resumen final antes del commit
echo ""
echo -e "${BLUE}📊 Resumen de cambios preparados para commit:${NC}"
git diff --staged --stat

echo ""
echo -e "${YELLOW}🤔 ¿Proceder con el commit? (y/n)${NC}"
read -r response
if [[ "$response" != "y" ]]; then
    echo -e "${YELLOW}❌ Merge cancelado - restaurando estado anterior${NC}"
    git reset --hard HEAD
    git checkout "$CURRENT_BRANCH"
    git branch -D "$BACKUP_BRANCH"
    echo -e "${GREEN}✅ Estado restaurado${NC}"
    exit 0
fi

# 10. Commit final
echo -e "${BLUE}💾 Realizando commit final...${NC}"
git commit -m "Merge dev into main: $(git diff --staged --name-only | wc -l) files updated"

# 11. Limpiar y finalizar
git branch -D "$BACKUP_BRANCH"
echo -e "${GREEN}🗑️  Backup eliminado${NC}"

# Volver a la rama original si no era main
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    git checkout "$CURRENT_BRANCH"
    echo -e "${BLUE}📍 Volviendo a rama: $CURRENT_BRANCH${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ¡Merge dev → main completado exitosamente!${NC}"
echo -e "${GREEN}✅ main actualizado con tus cambios revisados${NC}"
echo -e "${BLUE}📊 Total archivos modificados: $(git diff HEAD~1..HEAD --name-only | wc -l)${NC}"

# Opcional: Mostrar últimos commits
echo ""
echo -e "${CYAN}📋 Últimos commits en main:${NC}"
git log --oneline -3

echo ""
echo -e "${YELLOW}💡 Próximos pasos opcionales:${NC}"
echo -e "${YELLOW}   - git push origin main${NC}"
echo -e "${YELLOW}   - Actualizar dev: git checkout dev && git merge main --ff-only${NC}"