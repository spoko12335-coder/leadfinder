# TrafKlienta 7.4 — pełny rebranding marki

## Nowa nazwa

Dotychczasowy LeadFinder działa teraz jako **TrafKlienta**.

Hasło: **Znajdź firmy. Nawiąż kontakt. Zdobądź klienta.**

## Co zostało zmienione

- nazwa na wszystkich ekranach aplikacji,
- tytuł strony, opis i dane PWA,
- Regulamin, Polityka prywatności, źródła danych i usuwanie konta,
- komunikaty systemowe i nazwy plików CSV,
- nazwy pakietów w interfejsie,
- wersje dokumentów prawnych na `1.2-2026-06-15`,
- przygotowane teksty do Google Play.

## Czego celowo nie zmieniono

Techniczne klucze `leadfinder_*`, adres repozytorium `/leadfinder/`, nazwy tabel
i funkcji Supabase pozostają bez zmian. Dzięki temu użytkownicy nie tracą sesji,
zapisanych leadów ani historii. Można je migrować dopiero po wydaniu stabilnej
aplikacji Android.

## Instalacja

1. Uruchom `TrafKlienta-7-4-rebranding.sql` w Supabase.
2. Wgraj pliki z `TrafKlienta-7-4-aktualizacja.zip` na GitHub.
3. Otwórz `https://spoko12335-coder.github.io/leadfinder/?v=7.4`.
4. Naciśnij `Ctrl + F5`.

## Następny etap

Projekt Android z identyfikatorem: `pl.kamilmazur.trafklienta`.
