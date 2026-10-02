import json
import re
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "sw.js").read_text(encoding="utf-8")


class IdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, _tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])


class MonsterBopperIntegrityTests(unittest.TestCase):
    def test_html_ids_are_unique(self):
        parser = IdCollector()
        parser.feed(INDEX)
        duplicates = [name for name, count in Counter(parser.ids).items() if count > 1]
        self.assertEqual([], duplicates)

    def test_quick_start_precedes_extra_modes(self):
        self.assertLess(INDEX.index('id="quickStart"'), INDEX.index('id="modeRow"'))
        self.assertIn("PLAY BATTLE QUEST", INDEX)
        self.assertIn("$('quickStart').addEventListener('click'", INDEX)

    def test_failed_mouse_capture_has_a_pause_fallback(self):
        self.assertIn("else beginDesktopPlay()", INDEX)
        self.assertNotIn("else lockPointer()", INDEX)
        self.assertIn("if (playing && !locked) showPause()", INDEX)

    def test_kid_mode_protections_are_wired(self):
        expected = [
            "let kidMode = localStorage.getItem('mb_kid_mode') !== 'off'",
            "if (kidMode) dmg = Math.max(1, Math.ceil(dmg * .55))",
            "lives = (kidMode ? 4 : 3)",
            "if (kidMode || NIGHT.on",
            "if (!kidMode && level >= 4",
            "assistAim(dir)",
        ]
        for snippet in expected:
            self.assertIn(snippet, INDEX)

    def test_touch_defaults_are_lightweight(self):
        self.assertRegex(INDEX, r"\? \{ pr: Math\.min\(devicePixelRatio, 1\.25\), aa: false, shadows: false")
        self.assertIn("const fpsFloor = isTouch ? 42 : 34", INDEX)

    def test_family_cloud_is_disabled_and_has_no_public_endpoint(self):
        self.assertIn("const FAMILY_CLOUD_ENABLED = false", INDEX)
        self.assertIn("const BOARD_URL = ''", INDEX)
        self.assertIn("const FORT_URL = ''", INDEX)
        self.assertNotIn("api.npoint.io", INDEX)
        self.assertNotIn("npoint.io", INDEX)

    def test_public_source_has_generic_profiles(self):
        self.assertIn("const GENERIC_PLAYERS", INDEX)
        self.assertIn("const PLAYERS = localProfileNames()", INDEX)
        self.assertIn("mb_stats", INDEX)
        self.assertNotIn("const PLAYERS = [", INDEX)

    def test_network_status_uses_text_not_html(self):
        match = re.search(r"function netStatus\([^)]*\) \{([^}]+)\}", INDEX)
        self.assertIsNotNone(match)
        body = match.group(1)
        self.assertIn("textContent", body)
        self.assertNotIn("innerHTML", body)

    def test_titan_selection_is_remembered(self):
        self.assertIn("localStorage.getItem('mb_titan')", INDEX)
        self.assertIn("localStorage.setItem('mb_titan', tn.key)", INDEX)

    def test_offline_worker_caches_every_manifest_asset(self):
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn("navigator.serviceWorker.register('./sw.js')", INDEX)
        for icon in manifest["icons"]:
            path = ROOT / icon["src"]
            self.assertTrue(path.is_file(), path)
            self.assertIn("./" + icon["src"], WORKER)
        for required in ("./index.html", "./three.module.js", "./manifest.json"):
            self.assertIn(required, WORKER)

    def test_animal_world_has_real_and_mythical_unlocks(self):
        self.assertIn('id="goAnimal"', INDEX)
        self.assertIn('id="animalScreen"', INDEX)
        self.assertIn("const ANIMAL_HABITATS", INDEX)
        self.assertIn("const ANIMAL_BOOK", INDEX)
        self.assertGreaterEqual(INDEX.count("habitat:'"), 30)
        self.assertIn("mb_animals", INDEX)
        self.assertIn("animalRescueBop()", INDEX)
        self.assertIn("activeAnimal()", INDEX)

    def test_multiplayer_is_lan_only_without_relay_servers(self):
        launcher = (ROOT / "Play Monster Bopper.command").read_text(encoding="utf-8")
        self.assertIn("let LOCAL_FAMILY_PLAY = false", INDEX)
        self.assertIn("const NET_ROOM = './api/room'", INDEX)
        self.assertIn("const RTC_CFG = { iceServers: [] }", INDEX)
        self.assertIn("four-digit PIN", INDEX)
        self.assertNotIn("stun:", INDEX)
        self.assertIn("lan_server.py", launcher)
        self.assertIn("url.pathname.startsWith('/api/')", WORKER)

    def test_v10_mobile_overhaul_features_are_wired(self):
        expected = [
            'id="goParty"',
            'id="partyScreen"',
            'id="armoryScreen"',
            'id="btnDash"',
            "const WEAPON_LOADOUTS",
            "const PARTY_INFO",
            "DINO WILDS",
            "SKY TEMPLE",
            "TOYBOX PLANET",
        ]
        for snippet in expected:
            self.assertIn(snippet, INDEX)
        self.assertIn("'v10-20261002'", WORKER)
        self.assertIn("key.startsWith(CACHE_PREFIX)", WORKER)
        loadouts = re.search(r"const WEAPON_LOADOUTS = \[(.*?)\n\];", INDEX, re.S)
        self.assertIsNotNone(loadouts)
        self.assertEqual(6, len(re.findall(r"\{ key:'", loadouts.group(1))))

    def test_creature_shapes_are_consistent_not_random_parts(self):
        self.assertIn("const ARCH_SHAPE", INDEX)
        self.assertIn("const eyeN = boss ? 3 : 2", INDEX)
        self.assertIn("skin === 'default' && boss", INDEX)
        self.assertIn("Friendly faces for normal play", INDEX)

    def test_free_loadouts_have_no_store_or_outside_service(self):
        self.assertIn("ALL FREE", INDEX)
        self.assertIn("mb_loadout", INDEX)
        self.assertNotIn("Robux", INDEX)
        self.assertNotIn("checkout", INDEX.lower())
        self.assertNotIn("stripe.com", INDEX.lower())
        self.assertNotIn("paypal", INDEX.lower())

    def test_family_room_can_start_battle_quest(self):
        self.assertIn("mode:'battle'", INDEX)
        self.assertIn("startGame(true)", INDEX)
        self.assertIn("BATTLE_ON || CASTLE.on || ANIMAL.on", INDEX)


if __name__ == "__main__":
    unittest.main()
