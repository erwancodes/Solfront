import { useSettingsStore, type Language } from '@/stores/settingsStore'
import type { AIState, EnemyType } from '@/types/game'

const en = {
  'menu.rail': 'ARES DEFENCE NETWORK',
  'menu.command': 'MARTIAN ORBITAL COMMAND',
  'menu.tagline': 'Mars will not surrender.',
  'menu.copy': 'Earth crossed the heliopause with an invasion fleet. You are the last fighter between Ares Station and occupation.',
  'menu.start': 'START MISSION',
  'menu.controls': 'CONTROLS',
  'menu.options': 'OPTIONS',
  'menu.about': 'ABOUT',
  'menu.mission': 'MISSION // ARES SHIELD',
  'menu.threat': 'ACTIVE THREAT',
  'menu.theatre': 'THEATRE',
  'menu.orbit': 'MARS LOW ORBIT',
  'menu.hostiles': 'HOSTILES',
  'menu.fleet': 'TERRAN EXPEDITIONARY FLEET',
  'menu.objective': 'OBJECTIVE',
  'menu.hold': 'HOLD ARES STATION',
  'menu.survival': 'SURVIVAL',
  'menu.waves': '10 WAVES + COMMAND SHIP',
  'menu.scale': 'TACTICAL ORBIT // NOT TO SCALE',
  'menu.nasa': 'NASA PLANETARY IMAGERY',
  'menu.poly': 'POLY PIZZA FLEET MODELS',
  'modal.manual': 'FIELD MANUAL',
  'modal.close': 'CLOSE // ESC',
  'controls.title': 'Flight controls',
  'controls.help': 'Click the flight area after launch to link the mouse. Keyboard layouts AZERTY and QWERTY are both supported.',
  'controls.accelerate': 'Accelerate',
  'controls.brake': 'Brake / reverse',
  'controls.strafe': 'Lateral thrusters',
  'controls.aim': 'Pitch and yaw',
  'controls.fire': 'Fire cannons',
  'controls.lock': 'Lock target',
  'controls.boost': 'Engine boost',
  'controls.evade': 'Combat evade',
  'controls.nearest': 'Nearest target',
  'controls.pause': 'Pause mission',
  'options.title': 'System options',
  'options.copy': 'Choose the command interface language. Your selection is saved on this device.',
  'options.language': 'INTERFACE LANGUAGE',
  'options.english': 'ENGLISH',
  'options.french': 'FRANÇAIS',
  'about.title': 'The red line',
  'about.copy': 'Solfront is a browser-native 3D combat prototype. It uses a compressed solar system: celestial bodies use NASA imagery, while distances are tuned for a fast defensive arena.',
  'about.noBackend': 'NO BACKEND',
  'about.noAccount': 'NO ACCOUNT',
  'about.local': 'LOCAL ASSETS',
  'about.realtime': 'REAL-TIME 3D',
  'brief.classified': 'CLASSIFIED // MARS FLEET',
  'brief.index': 'MISSION BRIEF // 01',
  'brief.title': 'Hold the line above Mars.',
  'brief.year': 'Year 2189.',
  'brief.independence': 'Mars has declared its independence.',
  'brief.fleet': 'Earth has deployed its fleet toward the red planet.',
  'brief.mission': 'Your mission is to defend the Martian orbital station and stop the invasion.',
  'brief.directives': 'PRIMARY DIRECTIVES',
  'brief.protect': 'Protect Ares orbital station.',
  'brief.survive': 'Survive ten assault waves.',
  'brief.destroy': 'Destroy the Terran command ship.',
  'brief.loss': 'LOSS CONDITION: FIGHTER OR STATION DESTROYED',
  'brief.return': 'RETURN TO COMMAND',
  'brief.ready': 'READY',
  'brief.deploy': 'DEPLOY FIGHTER',
  'pause.link': 'FLIGHT LINK SUSPENDED',
  'pause.title': 'Mission paused',
  'pause.copy': 'Combat simulation time is frozen. Resume when your controls are ready.',
  'pause.resume': 'RESUME',
  'pause.restart': 'RESTART MISSION',
  'pause.menu': 'MAIN MENU',
  'hud.pause': 'PAUSE // ESC',
  'hud.wave': 'WAVE',
  'hud.final': 'FINAL CONTACT',
  'hud.boss': 'BOSS',
  'hud.hostiles': 'HOSTILES',
  'hud.score': 'COMBAT SCORE',
  'hud.fighter': 'MARTIAN FIGHTER // M-17',
  'hud.hull': 'HULL INTEGRITY',
  'hud.shield': 'DEFLECTOR SHIELD',
  'hud.energy': 'CORE ENERGY',
  'hud.heat': 'WEAPON THERMALS',
  'hud.overheat': 'WEAPONS OVERHEATED',
  'hud.station': 'ARES ORBITAL STATION',
  'hud.structure': 'STRUCTURAL STATE',
  'hud.defend': 'DEFEND AT ALL COSTS',
  'hud.velocity': 'VELOCITY',
  'hud.thrust': 'W/Z THRUST',
  'hud.strafe': 'A/Q D STRAFE',
  'hud.boost': 'SHIFT BOOST',
  'hud.evade': 'SPACE EVADE',
  'hud.fire': 'LMB FIRE',
  'hud.lock': 'RMB LOCK',
  'hud.link': 'CLICK FLIGHT AREA TO LINK MOUSE CONTROL',
  'hud.prepare': 'PREPARE FOR CONTACT',
  'radar.title': 'ORBITAL RADAR',
  'target.acquire': 'R — ACQUIRE NEAREST TARGET',
  'target.locked': 'LOCKED',
  'out.signalLost': 'SIGNAL LOST // M-17',
  'out.failure': 'MISSION FAILURE',
  'out.fallen': 'Mars has fallen silent.',
  'out.telemetry': 'Combat telemetry ended unexpectedly.',
  'out.score': 'FINAL SCORE',
  'out.wave': 'WAVE REACHED',
  'out.destroyed': 'HOSTILES DESTROYED',
  'out.again': 'FLY AGAIN',
  'victory.signal': 'MARTIAN SOVEREIGNTY SIGNAL',
  'victory.eliminated': 'ALL TERRAN CONTACTS ELIMINATED',
  'victory.title': 'MARS STANDS FREE',
  'victory.copy': 'Ares Station remains online. The invasion fleet is breaking orbit.',
  'victory.ships': 'SHIPS DESTROYED',
  'victory.time': 'SURVIVAL TIME',
  'victory.done': 'DONE',
  'victory.return': 'RETURN TO MARS',
  'loading.systems': 'MARTIAN FLIGHT SYSTEMS',
  'loading.degraded': 'Asset link degraded',
  'loading.calibrating': 'Calibrating orbital theatre',
  'loading.initializing': 'INITIALIZING',
  'error.link': 'RENDER LINK FAILURE',
  'error.title': 'The flight display could not initialize.',
  'error.reset': 'RESET',
  'error.reload': 'RELOAD SYSTEMS',
} as const

type TranslationKey = keyof typeof en

const fr: Record<TranslationKey, string> = {
  'menu.rail': 'RÉSEAU DE DÉFENSE D’ARÈS', 'menu.command': 'COMMANDEMENT ORBITAL MARTIEN',
  'menu.tagline': 'Mars ne se rendra pas.', 'menu.copy': 'La Terre a franchi l’héliopause avec une flotte d’invasion. Vous êtes le dernier chasseur entre la station Arès et l’occupation.',
  'menu.start': 'LANCER LA MISSION', 'menu.controls': 'COMMANDES', 'menu.options': 'OPTIONS', 'menu.about': 'À PROPOS',
  'menu.mission': 'MISSION // BOUCLIER D’ARÈS', 'menu.threat': 'MENACE ACTIVE', 'menu.theatre': 'THÉÂTRE', 'menu.orbit': 'ORBITE BASSE DE MARS',
  'menu.hostiles': 'HOSTILES', 'menu.fleet': 'FLOTTE EXPÉDITIONNAIRE TERRIENNE', 'menu.objective': 'OBJECTIF', 'menu.hold': 'TENIR LA STATION ARÈS',
  'menu.survival': 'SURVIE', 'menu.waves': '10 VAGUES + VAISSEAU AMIRAL', 'menu.scale': 'ORBITE TACTIQUE // HORS ÉCHELLE',
  'menu.nasa': 'IMAGERIE PLANÉTAIRE NASA', 'menu.poly': 'MODÈLES DE FLOTTE POLY PIZZA',
  'modal.manual': 'MANUEL DE VOL', 'modal.close': 'FERMER // ÉCHAP',
  'controls.title': 'Commandes de vol', 'controls.help': 'Cliquez dans la zone de vol après le lancement pour lier la souris. Les claviers AZERTY et QWERTY sont pris en charge.',
  'controls.accelerate': 'Accélérer', 'controls.brake': 'Freiner / marche arrière', 'controls.strafe': 'Propulseurs latéraux', 'controls.aim': 'Tangage et lacet',
  'controls.fire': 'Tirer', 'controls.lock': 'Verrouiller la cible', 'controls.boost': 'Surpuissance moteur', 'controls.evade': 'Esquive de combat',
  'controls.nearest': 'Cible la plus proche', 'controls.pause': 'Mettre en pause',
  'options.title': 'Options système', 'options.copy': 'Choisissez la langue de l’interface de commandement. Votre sélection est enregistrée sur cet appareil.',
  'options.language': 'LANGUE DE L’INTERFACE', 'options.english': 'ENGLISH', 'options.french': 'FRANÇAIS',
  'about.title': 'La ligne rouge', 'about.copy': 'Solfront est un prototype de combat 3D natif du navigateur. Son système solaire est compressé : les corps célestes utilisent des images de la NASA et les distances sont adaptées à une arène défensive rapide.',
  'about.noBackend': 'SANS BACKEND', 'about.noAccount': 'SANS COMPTE', 'about.local': 'RESSOURCES LOCALES', 'about.realtime': '3D TEMPS RÉEL',
  'brief.classified': 'CLASSIFIÉ // FLOTTE DE MARS', 'brief.index': 'BRIEFING MISSION // 01', 'brief.title': 'Tenez la ligne au-dessus de Mars.',
  'brief.year': 'Année 2189.', 'brief.independence': 'Mars a déclaré son indépendance.', 'brief.fleet': 'La Terre a déployé sa flotte vers la planète rouge.',
  'brief.mission': 'Votre mission est de défendre la station orbitale martienne et d’arrêter l’invasion.', 'brief.directives': 'DIRECTIVES PRIORITAIRES',
  'brief.protect': 'Protéger la station orbitale Arès.', 'brief.survive': 'Survivre à dix vagues d’assaut.', 'brief.destroy': 'Détruire le vaisseau amiral terrien.',
  'brief.loss': 'ÉCHEC : CHASSEUR OU STATION DÉTRUIT', 'brief.return': 'RETOUR AU COMMANDEMENT', 'brief.ready': 'PRÊT', 'brief.deploy': 'DÉPLOYER LE CHASSEUR',
  'pause.link': 'LIAISON DE VOL SUSPENDUE', 'pause.title': 'Mission en pause', 'pause.copy': 'Le temps de simulation est figé. Reprenez lorsque vos commandes sont prêtes.',
  'pause.resume': 'REPRENDRE', 'pause.restart': 'RECOMMENCER LA MISSION', 'pause.menu': 'MENU PRINCIPAL',
  'hud.pause': 'PAUSE // ÉCHAP', 'hud.wave': 'VAGUE', 'hud.final': 'CONTACT FINAL', 'hud.boss': 'BOSS', 'hud.hostiles': 'HOSTILES',
  'hud.score': 'SCORE DE COMBAT', 'hud.fighter': 'CHASSEUR MARTIEN // M-17', 'hud.hull': 'INTÉGRITÉ COQUE', 'hud.shield': 'BOUCLIER DÉFLECTEUR',
  'hud.energy': 'ÉNERGIE DU CŒUR', 'hud.heat': 'TEMPÉRATURE ARMES', 'hud.overheat': 'ARMES EN SURCHAUFFE', 'hud.station': 'STATION ORBITALE ARÈS',
  'hud.structure': 'ÉTAT STRUCTUREL', 'hud.defend': 'DÉFENDRE À TOUT PRIX', 'hud.velocity': 'VITESSE', 'hud.thrust': 'W/Z POUSSÉE',
  'hud.strafe': 'A/Q D LATÉRAL', 'hud.boost': 'MAJ BOOST', 'hud.evade': 'ESPACE ESQUIVE', 'hud.fire': 'CLIC G TIR', 'hud.lock': 'CLIC D CIBLE',
  'hud.link': 'CLIQUEZ DANS LA ZONE DE VOL POUR LIER LA SOURIS', 'hud.prepare': 'PRÉPAREZ LE CONTACT',
  'radar.title': 'RADAR ORBITAL', 'target.acquire': 'R — ACQUÉRIR LA CIBLE LA PLUS PROCHE', 'target.locked': 'VERROUILLÉ',
  'out.signalLost': 'SIGNAL PERDU // M-17', 'out.failure': 'ÉCHEC DE LA MISSION', 'out.fallen': 'Mars est devenue silencieuse.',
  'out.telemetry': 'La télémétrie de combat s’est interrompue.', 'out.score': 'SCORE FINAL', 'out.wave': 'VAGUE ATTEINTE', 'out.destroyed': 'HOSTILES DÉTRUITS',
  'out.again': 'REPARTIR AU COMBAT', 'victory.signal': 'SIGNAL DE SOUVERAINETÉ MARTIENNE', 'victory.eliminated': 'TOUS LES CONTACTS TERRIENS ÉLIMINÉS',
  'victory.title': 'MARS RESTE LIBRE', 'victory.copy': 'La station Arès est toujours opérationnelle. La flotte d’invasion quitte l’orbite.',
  'victory.ships': 'VAISSEAUX DÉTRUITS', 'victory.time': 'TEMPS DE SURVIE', 'victory.done': 'TERMINÉ', 'victory.return': 'RETOUR SUR MARS',
  'loading.systems': 'SYSTÈMES DE VOL MARTIENS', 'loading.degraded': 'Liaison aux ressources dégradée', 'loading.calibrating': 'Calibration du théâtre orbital',
  'loading.initializing': 'INITIALISATION',
  'error.link': 'ÉCHEC DE LA LIAISON DE RENDU', 'error.title': 'L’affichage de vol n’a pas pu démarrer.',
  'error.reset': 'RÉINITIALISER', 'error.reload': 'RECHARGER LES SYSTÈMES',
}

const dictionaries = { en, fr }

export function translate(key: TranslationKey, language: Language) {
  return dictionaries[language][key]
}

export function useI18n() {
  const language = useSettingsStore((state) => state.language)
  return { language, t: (key: TranslationKey) => translate(key, language) }
}

export function translateMissionMessage(message: string, language: Language) {
  if (language === 'en') return message
  const waveIncoming = message.match(/^WAVE (\d+) INBOUND$/)
  if (waveIncoming) return `VAGUE ${waveIncoming[1]} EN APPROCHE`
  const waveEngage = message.match(/^WAVE (\d+) — ENGAGE$/)
  if (waveEngage) return `VAGUE ${waveEngage[1]} — ENGAGEZ`
  const messages: Record<string, string> = {
    'ORBITAL LINK STANDBY': 'LIAISON ORBITALE EN ATTENTE',
    'MARS ORBIT SECURED — PREPARE': 'ORBITE DE MARS SÉCURISÉE — PRÉPAREZ-VOUS',
    'MISSION RESTARTED': 'MISSION RELANCÉE',
    'COMMAND SHIP SIGNATURE INBOUND': 'SIGNATURE DU VAISSEAU AMIRAL EN APPROCHE',
    'TERRAN DREADNOUGHT DETECTED': 'CUIRASSÉ TERRIEN DÉTECTÉ',
    'STATION SIGNAL LOST': 'SIGNAL DE LA STATION PERDU',
    'STATION UNDER FIRE': 'STATION SOUS LE FEU',
    'DREADNOUGHT CORE COLLAPSE': 'EFFONDREMENT DU CŒUR DU CUIRASSÉ',
  }
  return messages[message] ?? message
}

export function translateGameOverReason(reason: string | null, language: Language) {
  if (language === 'en' || !reason) return reason
  if (reason === 'The Martian orbital station was destroyed.') return 'La station orbitale martienne a été détruite.'
  if (reason === 'Your fighter hull was breached.') return 'La coque de votre chasseur a été éventrée.'
  return reason
}

export function translateEnemy(type: EnemyType, language: Language) {
  const labels: Record<EnemyType, [string, string]> = {
    fighter: ['EARTH FIGHTER', 'CHASSEUR TERRIEN'],
    interceptor: ['EARTH INTERCEPTOR', 'INTERCEPTEUR TERRIEN'],
    bomber: ['EARTH BOMBER', 'BOMBARDIER TERRIEN'],
    boss: ['TERRAN DREADNOUGHT', 'CUIRASSÉ TERRIEN'],
  }
  return labels[type][language === 'fr' ? 1 : 0]
}

export function translateAIState(state: AIState, language: Language) {
  if (language === 'en') return state
  return ({ PATROL: 'PATROUILLE', CHASE: 'POURSUITE', ATTACK: 'ATTAQUE', EVADE: 'ESQUIVE', DESTROYED: 'DÉTRUIT' } as const)[state]
}
