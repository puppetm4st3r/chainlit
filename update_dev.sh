#!/bin/bash

# Script para actualizar dev después del proceso de sync completo
# Uso: ./update_dev.sh
# Ejecutar DESPUÉS de sync_upstream.sh y merge_dev_to_main.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

CURRENT_BRANCH=$(git branch --show-current)
BACKUP_BRANCH="backup/dev-before-update-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}🔄 Iniciando actualización de dev${NC}"
echo -e "${BLUE}📍 Rama actual: $CURRENT_BRANCH${NC}"

# 1. Verificar que estamos en un estado limpio
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ ERROR: Tienes cambios sin commitear${NC}"
    echo "Por favor, commitea o guarda tus cambios antes de continuar"
    exit 1
fi

# 2. Analizar el estado de las ramas
echo -e "${BLUE}🔍 Analizando estado de las ramas...${NC}"

# Verificar que main existe y está actualizado
if ! git show-ref --verify --quiet refs/heads/main; then
    echo -e "${RED}❌ ERROR: Rama main no existe${NC}"
    exit 1
fi

# Verificar que dev existe
if ! git show-ref --verify --quiet refs/heads/dev; then
    echo -e "${RED}❌ ERROR: Rama dev no existe${NC}"
    exit 1
fi

# Commits que dev tiene y main no tiene
DEV_AHEAD=$(git rev-list --count main..dev)
# Commits que main tiene y dev no tiene  
DEV_BEHIND=$(git rev-list --count dev..main)

echo -e "${CYAN}📊 Estado de dev respecto a main:${NC}"
echo -e "${CYAN}   - Dev está $DEV_AHEAD commits adelante de main${NC}"
echo -e "${CYAN}   - Dev está $DEV_BEHIND commits atrás de main${NC}"

# 3. Determinar estrategia según el estado
if [[ $DEV_AHEAD -eq 0 && $DEV_BEHIND -eq 0 ]]; then
    echo -e "${GREEN}✅ dev y main están sincronizados${NC}"
    echo -e "${GREEN}No hay nada que actualizar${NC}"
    exit 0
fi

if [[ $DEV_AHEAD -eq 0 && $DEV_BEHIND -gt 0 ]]; then
    echo -e "${GREEN}🎯 Situación ideal: Fast-forward posible${NC}"
    echo -e "${GREEN}dev puede actualizarse limpiamente con main${NC}"
    STRATEGY="fast-forward"
elif [[ $DEV_AHEAD -gt 0 && $DEV_BEHIND -gt 0 ]]; then
    echo -e "${YELLOW}⚠️  Situación compleja: dev tiene commits nuevos${NC}"
    echo -e "${PURPLE}📋 Commits en dev que no están en main:${NC}"
    git log --oneline main..dev | head -5
    if [[ $DEV_AHEAD -gt 5 ]]; then
        echo -e "${CYAN}... y $(($DEV_AHEAD - 5)) commits más${NC}"
    fi
    echo ""
    echo -e "${YELLOW}🤔 ¿Qué estrategia prefieres?${NC}"
    echo -e "${CYAN}1) Fast-forward (PERDER commits nuevos de dev)${NC}"
    echo -e "${CYAN}2) Merge (conservar commits + crear merge commit)${NC}"
    echo -e "${CYAN}3) Rebase (reescribir commits sobre main)${NC}"
    echo -e "${CYAN}4) Cancelar y revisar manualmente${NC}"
    read -p "Selecciona (1-4): " choice
    
    case $choice in
        1) STRATEGY="reset" ;;
        2) STRATEGY="merge" ;;
        3) STRATEGY="rebase" ;;
        4) echo -e "${YELLOW}❌ Operación cancelada${NC}"; exit 0 ;;
        *) echo -e "${RED}❌ Opción inválida${NC}"; exit 1 ;;
    esac
else
    echo -e "${GREEN}🎯 Dev solo tiene commits adelante (raro después del proceso)${NC}"
    STRATEGY="merge"
fi

# 4. Crear backup de dev
echo -e "${YELLOW}💾 Creando backup de dev: $BACKUP_BRANCH${NC}"
git checkout dev
git checkout -b "$BACKUP_BRANCH"
git checkout dev

# 5. Ejecutar la estrategia seleccionada
echo -e "${BLUE}🔄 Ejecutando estrategia: $STRATEGY${NC}"

case $STRATEGY in
    "fast-forward")
        echo -e "${BLUE}📈 Haciendo fast-forward merge...${NC}"
        if git merge main --ff-only; then
            echo -e "${GREEN}✅ Fast-forward exitoso${NC}"
            SUCCESS=true
        else
            echo -e "${RED}❌ Fast-forward falló inesperadamente${NC}"
            SUCCESS=false
        fi
        ;;
        
    "reset")
        echo -e "${YELLOW}⚠️  Reseteando dev a main (perderás commits nuevos)${NC}"
        echo -e "${YELLOW}¿Estás seguro? (y/n)${NC}"
        read -r confirm
        if [[ "$confirm" == "y" ]]; then
            git reset --hard main
            echo -e "${GREEN}✅ Dev reseteado a main${NC}"
            SUCCESS=true
        else
            echo -e "${YELLOW}❌ Reset cancelado${NC}"
            SUCCESS=false
        fi
        ;;
        
    "merge")
        echo -e "${BLUE}🔀 Haciendo merge de main en dev...${NC}"
        if git merge main --no-edit; then
            echo -e "${GREEN}✅ Merge exitoso${NC}"
            SUCCESS=true
        else
            echo -e "${RED}🚨 Conflictos detectados en el merge${NC}"
            echo -e "${YELLOW}🔧 Abriendo Meld para resolver conflictos...${NC}"
            
            # Configurar merge tool
            git config merge.tool meld 2>/dev/null || true
            
            if git mergetool; then
                # Limpiar archivos .orig
                find . -name "*.orig" -delete 2>/dev/null || true
                git commit --no-edit
                echo -e "${GREEN}✅ Conflictos resueltos y merge completado${NC}"
                SUCCESS=true
            else
                echo -e "${RED}❌ Error resolviendo conflictos${NC}"
                SUCCESS=false
            fi
        fi
        ;;
        
    "rebase")
        echo -e "${BLUE}🔄 Haciendo rebase de dev sobre main...${NC}"
        if git rebase main; then
            echo -e "${GREEN}✅ Rebase exitoso${NC}"
            SUCCESS=true
        else
            echo -e "${RED}🚨 Conflictos detectados en el rebase${NC}"
            echo -e "${YELLOW}🔧 Resuelve conflictos manualmente y ejecuta:${NC}"
            echo -e "${YELLOW}   git rebase --continue${NC}"
            echo -e "${YELLOW}   o git rebase --abort para cancelar${NC}"
            echo -e "${BLUE}💾 Backup disponible en: $BACKUP_BRANCH${NC}"
            exit 1
        fi
        ;;
esac

# 6. Verificar éxito y limpiar
if [[ "$SUCCESS" == "true" ]]; then
    # Eliminar backup si todo salió bien
    git branch -D "$BACKUP_BRANCH"
    echo -e "${GREEN}🗑️  Backup eliminado${NC}"
    
    # Volver a la rama original si no era dev
    if [[ "$CURRENT_BRANCH" != "dev" ]]; then
        git checkout "$CURRENT_BRANCH"
        echo -e "${BLUE}📍 Volviendo a rama: $CURRENT_BRANCH${NC}"
    fi
    
    # Mostrar estado final
    echo ""
    echo -e "${GREEN}🎉 ¡Actualización de dev completada exitosamente!${NC}"
    
    # Analizar estado final
    FINAL_AHEAD=$(git rev-list --count main..dev)
    FINAL_BEHIND=$(git rev-list --count dev..main)
    
    echo -e "${CYAN}📊 Estado final de dev:${NC}"
    echo -e "${CYAN}   - Dev está $FINAL_AHEAD commits adelante de main${NC}"
    echo -e "${CYAN}   - Dev está $FINAL_BEHIND commits atrás de main${NC}"
    
    if [[ $FINAL_AHEAD -eq 0 && $FINAL_BEHIND -eq 0 ]]; then
        echo -e "${GREEN}✅ dev y main están perfectamente sincronizados${NC}"
    fi
    
    echo ""
    echo -e "${PURPLE}📋 Últimos commits en dev:${NC}"
    git checkout dev >/dev/null 2>&1
    git log --oneline -3
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
    
else
    echo -e "${RED}❌ Actualización falló${NC}"
    echo -e "${BLUE}💾 Backup disponible en: $BACKUP_BRANCH${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🏁 Proceso completo de sincronización finalizado:${NC}"
echo -e "${GREEN}   1. ✅ upstream/main → main (sync_upstream.sh)${NC}"
echo -e "${GREEN}   2. ✅ dev → main (merge_dev_to_main.sh)${NC}"
echo -e "${GREEN}   3. ✅ main → dev (update_dev.sh)${NC}"
echo ""
echo -e "${YELLOW}💡 Próximos pasos opcionales:${NC}"
echo -e "${YELLOW}   - git push origin main${NC}"
echo -e "${YELLOW}   - git push origin dev${NC}"