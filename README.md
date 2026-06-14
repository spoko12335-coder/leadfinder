# LeadFinder PWA

Mobilna aplikacja testowa do wyszukiwania lokalnych firm bez podanego adresu strony WWW.

## Co działa

- wyszukiwanie firm według miasta, branży i promienia,
- dane z OpenStreetMap przez Nominatim i Overpass API,
- filtr firm bez strony WWW,
- filtry: numer telefonu oraz media społecznościowe,
- zapisywanie leadów lokalnie w pamięci telefonu,
- statusy kontaktu,
- generowanie wiadomości ofertowej,
- eksport CSV,
- instalacja na ekranie głównym jako PWA.

## Uruchomienie przez GitHub Pages — również z telefonu

1. Zaloguj się na GitHub.
2. Utwórz nowe repozytorium, np. `leadfinder`.
3. Rozpakuj pobrany plik ZIP.
4. W repozytorium wybierz **Add file → Upload files**.
5. Prześlij wszystkie pliki i katalog `icons`, a następnie zatwierdź zmiany.
6. Otwórz **Settings → Pages**.
7. W części **Build and deployment** ustaw:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
8. Zapisz ustawienia. GitHub pokaże adres aplikacji.
9. Otwórz adres w Chrome na telefonie.
10. Z menu Chrome wybierz **Dodaj do ekranu głównego** albo użyj przycisku **Zainstaluj** w aplikacji.

## Istotne ograniczenia wersji testowej

- Brak pola `website` w OpenStreetMap nie gwarantuje, że firma nie ma strony.
- Publiczne serwery Nominatim i Overpass mają ograniczenia wydajności. Wyszukiwanie jest wykonywane wyłącznie po działaniu użytkownika.
- Dane zapisane w sekcji „Zapisane” znajdują się tylko w pamięci konkretnej przeglądarki/telefonu.
- Do wersji komercyjnej należy dodać własny backend, bazę danych i bardziej wiarygodną weryfikację stron.

## Pliki

- `index.html` — interfejs,
- `styles.css` — wygląd,
- `app.js` — wyszukiwanie i obsługa leadów,
- `manifest.webmanifest` — instalacja PWA,
- `sw.js` — pamięć podręczna/offline,
- `icons/` — ikony aplikacji.
