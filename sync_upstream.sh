#!/bin/bash

# Script para sincronizar upstream/main hacia main local con revisión controlada
# Uso: ./sync_upstream.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

CURRENT_BRANCH=$(git branch --show-current)
BACKUP_BRANCH="backup/main-before-sync-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}🔄 Iniciando sincronización controlada upstream/main → main${NC}"
echo -e "${BLUE}📍 Rama actual: $CURRENT_BRANCH${NC}"

# 1. Verificar que estamos en un estado limpio
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ ERROR: Tienes cambios sin commitear${NC}"
    echo "Por favor, commitea o guarda tus cambios antes de continuar"
    exit 1
fi

# 2. Crear backup de la rama main actual
echo -e "${YELLOW}💾 Creando backup de main: $BACKUP_BRANCH${NC}"
git checkout main
git checkout -b "$BACKUP_BRANCH"
git checkout main

# 3. Fetch upstream
echo -e "${BLUE}📥 Obteniendo cambios del upstream...${NC}"
git fetch upstream

# 4. Mostrar cuántos commits nuevos hay
NEW_COMMITS=$(git rev-list --count main..upstream/main)
echo -e "${BLUE}📊 Nuevos commits en upstream: $NEW_COMMITS${NC}"

if [[ $NEW_COMMITS -eq 0 ]]; then
    echo -e "${GREEN}✅ Ya estás actualizado con upstream/main${NC}"
    git branch -D "$BACKUP_BRANCH"
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        git checkout "$CURRENT_BRANCH"
    fi
    exit 0
fi

# 5. Mostrar los commits que se van a traer
echo -e "${BLUE}📋 Commits que se aplicarán:${NC}"
git log --oneline --graph main..upstream/main | head -10
if [[ $NEW_COMMITS -gt 10 ]]; then
    echo -e "${CYAN}... y $(($NEW_COMMITS - 10)) commits más${NC}"
fi

# 6. Mostrar archivos que cambiarán
echo ""
echo -e "${BLUE}📁 Archivos que se modificarán:${NC}"
CHANGED_FILES=$(git diff --name-only main..upstream/main | wc -l)
git diff --name-only main..upstream/main | head -15
if [[ $CHANGED_FILES -gt 15 ]]; then
    echo -e "${CYAN}... y $(($CHANGED_FILES - 15)) archivos más${NC}"
fi

echo -e "${CYAN}📊 Total: $CHANGED_FILES archivos modificados en $NEW_COMMITS commits${NC}"

# 7. Hacer merge sin commit para revisión
echo ""
echo -e "${BLUE}🔄 Iniciando merge upstream/main → main (sin commit)...${NC}"
if git merge upstream/main --no-commit --no-ff; then
    echo -e "${GREEN}✅ Merge automático exitoso${NC}"
    HAS_CONFLICTS=false
else
    echo -e "${YELLOW}⚠️  Detectados conflictos - se requiere resolución manual${NC}"
    HAS_CONFLICTS=true
fi

# 8. Resolver conflictos si existen
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

# 9. Revisar todos los cambios con difftool
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

# 10. Mostrar resumen final antes del commit
echo ""
echo -e "${BLUE}📊 Resumen de cambios preparados para commit:${NC}"
git diff --staged --stat

echo ""
echo -e "${YELLOW}🤔 ¿Proceder con el commit de sincronización? (y/n)${NC}"
read -r response
if [[ "$response" != "y" ]]; then
    echo -e "${YELLOW}❌ Sincronización cancelada - restaurando estado anterior${NC}"
    git reset --hard HEAD
    git checkout "$CURRENT_BRANCH"
    git branch -D "$BACKUP_BRANCH"
    echo -e "${GREEN}✅ Estado restaurado${NC}"
    exit 0
fi

# 11. Commit final
echo -e "${BLUE}💾 Realizando commit de sincronización...${NC}"
git commit -m "Sync with upstream/main: $NEW_COMMITS commits, $CHANGED_FILES files updated"

# 12. Limpiar y finalizar
git branch -D "$BACKUP_BRANCH"
echo -e "${GREEN}🗑️  Backup eliminado${NC}"

# Volver a la rama original si no era main
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    git checkout "$CURRENT_BRANCH"
    echo -e "${BLUE}📍 Volviendo a rama: $CURRENT_BRANCH${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ¡Sincronización upstream → main completada exitosamente!${NC}"
echo -e "${GREEN}✅ main actualizado con $NEW_COMMITS commits del upstream${NC}"
echo -e "${BLUE}📊 Total archivos modificados: $CHANGED_FILES${NC}"

# Mostrar últimos commits
echo ""
echo -e "${CYAN}📋 Últimos commits en main:${NC}"
git log --oneline -3

echo ""
echo -e "${YELLOW}💡 Próximos pasos opcionales:${NC}"
echo -e "${YELLOW}   - git push origin main${NC}"
echo -e "${YELLOW}   - Mergear dev: ./merge_dev_to_main.sh${NC}"