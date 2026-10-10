# -*- coding: utf-8 -*-
"""
Générateur de grille calendrier (mois par mois, tables HTML) pour
lecoledescoachs.fr.

Utilisé pour construire /calendrier-formation.html et la section aperçu de
/cqp-instructeur-fitness.html.

POURQUOI DES TABLES HTML ET PAS CSS GRID :
Un premier essai avec `display:grid` a produit une seule colonne dans l'outil
de rendu de test utilisé en session de travail (moteur WebKit ancien, sans
support fiable de CSS Grid). Les vrais navigateurs modernes gèrent CSS Grid
sans problème, mais par prudence (et parce qu'un calendrier EST une table de
données), ce générateur utilise de vraies balises <table> — le standard le
plus universellement supporté, aucun risque de régression.

USAGE :
1. Définir vos plages de dates colorées dans `ranges` (liste de tuples
   (catégorie, date_debut, date_fin)).
2. Définir les mois à afficher dans `months`.
3. Appeler build_html(months, ranges) → retourne le HTML des cartes mois.
4. Injecter dans la page, avec le CSS assorti (voir calendar_grid.css).

⚠️ TOUJOURS vérifier les dates avec la source (Garry / fichier Excel) avant
publication — plusieurs erreurs de date ont dû être corrigées après coup dans
le passé sur ce projet, notamment quand les dates venaient d'une capture
d'écran plutôt que d'un fichier source exploitable.
"""
import calendar
from datetime import date

calendar.setfirstweekday(calendar.MONDAY)
DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"]


def get_month_html(year, month, label, ranges, prefix="rc"):
    """Génère le HTML d'un seul mois (carte + table des jours).

    ranges: liste de (categorie, date_debut, date_fin) inclusifs.
    prefix: préfixe CSS ("rc" pour le site web, "pm" pour les PDF imprimés).
    """
    cal = calendar.monthcalendar(year, month)

    def get_category(d):
        for cat, start, end in ranges:
            if start <= d <= end:
                return cat
        return None

    html = f'<div class="{prefix}-month">\n<div class="{prefix}-month-title">{label}</div>\n'
    html += f'<table class="{prefix}-table">\n<tr>'
    for dh in DAY_HEADERS:
        html += f'<th class="{prefix}-dh">{dh}</th>'
    html += '</tr>\n'

    for week in cal:
        html += '<tr>'
        for day in week:
            if day == 0:
                html += f'<td class="{prefix}-cell {prefix}-empty"></td>'
            else:
                d = date(year, month, day)
                cat = get_category(d)
                cls = f"{prefix}-cell {prefix}-{cat}" if cat else f"{prefix}-cell"
                html += f'<td class="{cls}">{day}</td>'
        html += '</tr>\n'

    html += '</table>\n</div>\n'
    return html


def build_html(months, ranges, prefix="rc"):
    """months: liste de (year, month, label). Retourne le wrapper complet."""
    html = f'<div class="{prefix}-wrap">\n'
    for y, m, label in months:
        html += get_month_html(y, m, label, ranges, prefix)
    html += '</div>\n'
    return html


# ============================================================
# EXEMPLE D'USAGE (à adapter avec vos vraies dates vérifiées)
# ============================================================
if __name__ == "__main__":
    ranges_exemple = [
        ("tep", date(2026, 9, 5), date(2026, 9, 5)),
        ("cours", date(2026, 9, 12), date(2026, 9, 13)),
        ("cours", date(2026, 9, 19), date(2026, 9, 20)),
    ]
    months_exemple = [(2026, 9, "Septembre 2026"), (2026, 10, "Octobre 2026")]

    html = build_html(months_exemple, ranges_exemple)
    print(html)
