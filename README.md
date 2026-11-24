# BarPulse ⚡
> Nocny radar miejski, interaktywna mapa lokali OpenStreetMap i rywalizacja ekip barowych.

---

### Status prac:
- [x] **Prawdziwa mapa OpenStreetMap + Leaflet**:
  - W pełni interaktywna mapa zoptymalizowana pod tryb nocny (CartoDB Dark Matter / ciemny filtr OSM).
  - Pulsujące radary barowe z rozróżnieniem lokali (Puby, Craft Beer, Kluby Muzyczne, Bary, Browary, Shot Bary).
  - Rozróżnienie lokali odwiedzonych (neonowy szmaragd) oraz nieodwiedzonych (bursztynowy amber).
  - Wyszukiwarka lokali w czasie rzeczywistym i filtry kategorii.
  - Lokalizacja GPS użytkownika z dynamicznym obliczaniem odległości w linii prostej i nawigacją w Google Maps.
  - Szybkie oznaczanie lokali jako odwiedzone.
- [x] **Pobieranie danych z sieci (OSM Overpass API + Nominatim)**:
  - Automatyczne pobieranie rzeczywistych danych z OpenStreetMap z geokodowaniem Nominatim.
  - Wbudowany serwerowy cache i zabezpieczenie w postaci bazy zapasowej (Rzeszów, Kraków, Warszawa, Wrocław, Gdańsk, Poznań).
  - Możliwość wyboru dowolnego miasta w Polsce i na świecie.
- [x] **Zaawansowana customizacja profilu użytkownika**:
  - Wybór awatara spośród 16 unikalnych emblematów imprezowych.
  - Rangi i tytuły barowe (*Nowicjusz*, *Agent Nocny*, *Koneser Chmielu*, *Weteran Szlaku*, *Legenda Melanżu*).
  - Ulubiony trunek i własne motto/bio.
  - System odznak i statystyki wkładu w ekipę.
- [x] **Zaawansowana customizacja i zarządzanie ekipą**:
  - Wybór herbu ekipy i motywu kolorystycznego (Amber, Emerald, Violet, Cyan, Rose).
  - Nazwa, motto i rewir operacyjny ekipy.
  - Kody zaproszeń z kopiowaniem do schowka.
  - System rang wewnątrz ekipy: **Lider**, **Oficer**, **Członek**.
  - Zarządzanie składem: awansowanie, degradowanie, usuwanie członków.
  - System poziomów ekipy (Lvl 1 - 5) i tablica wyników w mieście.

---

### Uruchomienie projektu:

1. **Instalacja zależności**:
   ```bash
   npm install
   ```

2. **Baza danych (opcjonalnie)**:
   Aplikacja posiada wbudowaną pamięć podręczną na czas lokalnego testowania, ale można podpiąć bazę PostgreSQL:
   ```env
   POSTGRES_PRISMA_URL="postgresql://user:password@localhost:5432/barpulse?schema=public"
   POSTGRES_URL_NON_POOLING="postgresql://user:password@localhost:5432/barpulse?schema=public"
   ```
   A następnie wykonać:
   ```bash
   npx prisma db push
   ```

3. **Uruchomienie serwera deweloperskiego**:
   ```bash
   npm run dev
   ```
   Aplikacja będzie dostępna pod adresem: `http://localhost:3000`.
