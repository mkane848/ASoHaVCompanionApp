/** Static content for the in-app Safety Tools page, taken from the "Safety Tools" chapter of
 *  `Planning Docs/Ruleset-V0.7.md` (L184-338), which reproduces the TTRPG Safety Toolkit guide.
 *
 *  The licence note and the credit line are quoted exactly as V0.7 gives them (L174-180) and are
 *  pinned to that file by `safetyToolsContent.test.ts`, so a change to the ruleset's wording fails a
 *  test rather than silently leaving the app out of step. The tool summaries below are the
 *  chapter's own prose, lightly de-formatted: Markdown bold is dropped, and the one unbalanced
 *  quotation mark in the N-card paragraph (L224, `"fade to black.`) is closed. Nothing else is
 *  reworded.
 *
 *  Plain data and no JSX so the About modal and the page share one copy of the credit. */

import { SAFETY_TOOLKIT_CREDIT, SAFETY_TOOLKIT_URL } from './safetyToolkitCredit.js';

export { SAFETY_TOOLKIT_CREDIT, SAFETY_TOOLKIT_URL };

/** V0.7 L174-178, in order. The links V0.7 attaches to words inside these paragraphs are listed
 *  separately in `LICENCE_LINKS` rather than embedded: an in-sentence link cannot hold its own
 *  44x44 hit area, which this app requires of every link. */
export const SAFETY_TOOLKIT_LICENCE: string[] = [
  'Please contact us (Email us at contact@ttrpgsafetytoolkit.com.)  if you would like to use the TTRPG Safety Toolkit Guide or the Cards in your TTRPG, module/adventure, supplement, etc. However, we are invoking a version of the Olivia Hill rule, where you cannot include the TTRPG Safety Toolkit Guide or the Cards in your work if you are a fascist.',
  'If you are including or crediting a specific tool in your product or games, please refer back to the Credits page and provide proper attribution to the creators in accordance to their own permissions.',
  'To credit the TTRPG Safety Toolkit itself, please include the following text:',
];

export const LICENCE_LINKS: { label: string; href: string }[] = [
  { label: 'Email contact@ttrpgsafetytoolkit.com', href: 'mailto:contact@ttrpgsafetytoolkit.com' },
  { label: 'The Olivia Hill rule', href: 'https://rpgmuseum.fandom.com/wiki/No_fascists' },
  { label: 'Toolkit Credits page', href: 'https://drive.google.com/open?id=1XD1PA7vdPsDIKMjW9b1AzOMoKAhtR2v_T46tVfsMZqI' },
  { label: 'ttrpgsafetytoolkit.com', href: SAFETY_TOOLKIT_URL },
];

export interface SafetyTopic {
  heading: string;
  paragraphs: string[];
}

export interface SafetyChapter {
  heading: string;
  topics: SafetyTopic[];
}

/** V0.7 L184 — the paragraph that opens the guide. */
export const SAFETY_INTRO =
  'Playing tabletop roleplaying games can be fun and fulfilling experiences. However, making sure that the GM, players, and potential audience feel safe is important. This is a quick reference guide on how to incorporate safety tools into your TTRPG games to make sure that everyone is having fun.';

export const SAFETY_CHAPTERS: SafetyChapter[] = [
  {
    heading: 'Safety Tools',
    topics: [
      {
        heading: 'What are Safety Tools?',
        paragraphs: [
          'Sometimes games have content or situations where a player or GM may feel stressed out, unsafe, or otherwise not having fun. Safety tools are a way for players and GMs to communicate and check-in before, during, and after a game in order to make sure everyone is still having fun, and to provide the right support when needed.',
        ],
      },
      {
        heading: 'Communication, Trust, and Care',
        paragraphs: [
          'The key to safety tools is communication and trust. There needs to be open and respectful communication alongside a culture of trust for these to work.',
          'As a GM, player, or organizer, you can create this culture by making it clear that the care and well-being of everyone at the table comes before the game or story. This can be done by actively listening to everyone, offering accommodations and safety tools, implementing actions when asked while not prying (nobody owes you their trauma as explanation), and actively checking in before, during, and after a game.',
        ],
      },
      {
        heading: 'The Toolkit',
        paragraphs: [
          'Different safety tools work better for different people and games. Finding the ones that best suit the needs of everyone at the table is important, and should be facilitated through discussion at the start of every new game or new group.',
          'This guide provides summaries of some safety tools and techniques (with the original designers\' permission) to add to your own toolkit. This includes the X-card system, the Luxton Technique, and more.',
          'Sources and links are provided at the end of this guide for the full original materials, and the toolkit is regularly updated with new tools.',
        ],
      },
    ],
  },
  {
    heading: 'Before the Game Begins',
    topics: [
      {
        heading: 'Session 0',
        paragraphs: [
          'Session 0s are a great way to begin communication, set expectations on the kind of story and play, and introduce and discuss what safety tools will be used at the table.',
        ],
      },
      {
        heading: 'Lines and Veils',
        paragraphs: [
          'Lines and veils are used to set boundaries on content in a game. Lines are hard limits on content, things that the GM or the players don\'t want to engage in. Setting up a line means that content won\'t show up in the game at all. Veils are soft limits, things that are ok "behind a curtain" or when they "cut-to-black." Setting up a veil means that the content might be in the game but not spotlighted or described in great detail. Lines and veils can be adjusted as needed throughout the game.',
          'For additional nuance in setting boundaries, you may also want to set up “Ask first" for content that is ok to show up in the game but requires a check-in before implementing, and "Yes please" for content you definitely want to include.',
        ],
      },
      {
        heading: 'Luxton Technique Discussion',
        paragraphs: [
          'In the Luxton Technique, have an open discussion between everyone at the table about potential trauma triggers. This is with the understanding that it\'s not possible to identify every single possible trigger or trauma, and that there is no social pressure to go into details or individual justifications for a trigger.',
        ],
      },
      {
        heading: 'Monte Cook RPG Consent Checklist',
        paragraphs: [
          'The RPG Consent Checklist created by Monte Cook Games as part of their Consent in Gaming resource is another approach you can use for setting expectations and content boundaries.',
        ],
      },
    ],
  },
  {
    heading: 'During the Game',
    topics: [
      {
        heading: 'X, N, and O Cards',
        paragraphs: [
          'X, N, and O cards are check-in tools. They can be used by tapping physical cards, typing the letter in the chat function of the video conference software or virtual tabletop you are using, or using hand signals. Before the game begins, remind everyone that they are available and how to use them.',
          'The X card can be used at any point if a participant is uncomfortable with the content happening in-game. When the X card is used by tapping the card or typing an "X" in the chat, the group can change, rewind, or skip the content.',
          'The N card can be used at any point if a participant feels like they are headed towards an X. When the N card is used by tapping the card or typing an "N" in the chat, the group can change the content or have the scene "fade to black."',
          'The O card can be used at any point if a participant wants to continue with the content. When the O card is used by tapping the card or typing an "O" in the chat, the group is ok to continue with the content. They can also regularly be prompted by a "O?" asked out loud or in the chat to check-in if everyone is still ok.',
        ],
      },
      {
        heading: 'Luxton Technique',
        paragraphs: [
          'With the Luxton Technique, when a participant comes across triggering content in play, they can choose to discuss it with the other people at the table. The participant is given complete control over that content, expressed as a need or want for how play will continue. This can include in-game directions for plot and characters, as well as out of game needs such as breaks. After the need and wants are expressed, everyone continues play to accommodate the requests.',
        ],
      },
      {
        heading: 'Open Door',
        paragraphs: [
          'The Open Door is the assurance that someone can leave or take a break from the game for their own safety and well-being without being judged. State this at the beginning and periodically throughout the game.',
        ],
      },
    ],
  },
  {
    heading: 'After the Game',
    topics: [
      {
        heading: 'Bleed',
        paragraphs: [
          'Emotions and stress from the game can bleed over into post-game life. This can affect the enjoyment of the game, as well as out-of-game relationships between players and GM if not worked through.',
          'Being open and honest about where the game begins and ends, and being conscious of which feelings belong to the player and which are just bleed, helps to mitigate the effects.',
        ],
      },
      {
        heading: 'Aftercare',
        paragraphs: [
          'Together as a group after the game, check-in with everyone to see how they are feeling. This is an open way for everyone to emotionally decompress, talk through, and process the events of the session in a safe environment.',
          'Encourage everyone to practice their own forms of self-care and remind them that their mental health comes first.',
        ],
      },
      {
        heading: 'Debriefing',
        paragraphs: [
          'Debriefing as a group is a great way to reflect on the game, identify possible issues, highlight the fun things to continue, and work through potential bleed. Debriefing can happen right after the game or in the days following the stream.',
        ],
      },
      {
        heading: 'Stars and Wishes',
        paragraphs: [
          'Stars and wishes are used to reflect on the session and communicate feedback in a positive and forward-facing way. At the end of the game, go around and get everyone to state a star and wish. Stars are things that the participants really enjoyed and loved about the game. This could include a particular moment of roleplay, an encounter created by the GM, or anything else that stuck out as something awesome during the game. Wishes are things that the participants would like to see in future sessions. This could include particular interactions between characters, potential story moments and development, or anything else that could make the game even better in the future.',
        ],
      },
    ],
  },
  {
    heading: 'Safety in TTRPG Actual Plays',
    topics: [
      {
        heading: 'Applying Safety Tools to Actual Plays',
        paragraphs: [
          'When sharing your game via livestreams, podcasts, videos, etc., safety tools become incredibly important as there is another level of performance and intensity that is now public.',
        ],
      },
      {
        heading: 'Audience as a Participant',
        paragraphs: [
          'Because of the interactive and immersive nature of actual plays (especially livestreams), your audience becomes another participant in the game. Therefore, safety tools can and should be extended to them to some extent.',
        ],
      },
      {
        heading: 'Open Door',
        paragraphs: [
          'The Open Door is also extended to the audience. State at the beginning of the game and periodically throughout that they can leave or stop listening/watching at any point for their own safety and well-being without being judged.',
        ],
      },
      {
        heading: 'Content Warnings',
        paragraphs: [
          'Consider including a content warning about potentially uncomfortable content that regularly appears in your game. This can be done on streams via commands or within the overlay, and on podcasts and videos somewhere on the hosting site or in the episode description.',
        ],
      },
      {
        heading: 'Other Tools',
        paragraphs: [
          'For livestreams, you can implement other tools like the X, N, and O cards or the Luxton Technique for the audience via the chat. However, consider how to best implement them for your game and audience to accommodate needs while also mitigating possible misuse and disruption.',
        ],
      },
      {
        heading: 'Audience Bleed and Decompression',
        paragraphs: [
          'Audience can experience bleed as well, so having a space for them to discuss and decompress is recommended. Consider implementing tools such as stars and wishes. This can be done in a post-game on-stream chat with the cast, or in a community forum like Discord or Twitter.',
        ],
      },
    ],
  },
];

export interface SafetySource {
  text: string;
  href?: string;
}

/** V0.7 L298-312. The ruleset's links for the X card, the Luxton Technique and the Open Door are
 *  Google-search wrappers around the real address (an export artefact); the address itself is used. */
export const SAFETY_SOURCES: SafetySource[] = [
  { text: 'Lines and Veils were designed by Ron Edwards', href: 'https://rpg.stackexchange.com/questions/30906/what-do-the-terms-lines-and-veils-mean' },
  { text: 'The Consent in Gaming guide and RPG Consent Checklist was designed by Monte Cook Games', href: 'https://www.montecookgames.com/store/product/consent-in-gaming/' },
  { text: 'The X card was designed by John Stavropoulos', href: 'http://tinyurl.com/x-card-rpg' },
  { text: 'The O card was designed by Kira Magrann', href: 'https://serpentcyborggames.com' },
  { text: 'The N card was designed by Mysty Vander and Adam Cleaver, based on the Support Flower by Taylor Stokes' },
  { text: 'The Luxton Technique was originally written by P.H. Lee and reposted by Beau Jágr Sheldon', href: 'http://briebeau.com/thoughty/the-luxton-technique-by-p-h-lee/' },
  { text: 'The Open Door was designed by Eirik Fatland', href: 'http://leavingmundania.com/2014/02/27/primer-safety-in-roleplaying-games/' },
  { text: 'Stars and Wishes was designed by Lu Quade', href: 'https://www.gauntlet-rpg.com/blog/stars-and-wishes' },
];

/** V0.7 L318-320 (Acknowledgements). */
export const SAFETY_ACKNOWLEDGEMENTS: string[] = [
  'Thank you to the many safety tool designers and creators for giving permission to the TTRPG Safety Toolkit curation team to share their tools in this guide.',
  'Please appropriately attribute the tools to their original creators (credited above) according to their unique permissions when implementing them in your products or games.',
];

/** V0.7 L322-340 (Additional Notes). */
export const SAFETY_NOTES: SafetyTopic[] = [
  { heading: 'Additional resources', paragraphs: ['Other resources and tools can be found in the toolkit’s “Tools and Resources” folder.'] },
  { heading: 'Translations', paragraphs: ['Translations of this guide can be found in the toolkit’s “Translations” folder. We welcome additional translations in other languages.'] },
  {
    heading: 'Updates',
    paragraphs: [
      'The TTRPG Safety Toolkit is a living resource, and is therefore frequently updated. To have the most recent version of the guide and other resources, we recommend using the live link (bit.ly/ttrpgsafetytoolkit) rather than relying on downloaded versions of the toolkit.',
      'Receive news and updates about the toolkit in the #ttrpgsafetytoolkit tag on Twitter, or by following @TTRPGSafetyKit',
      'Find this guide and many more resources at bit.ly/ttrpgsafetytoolkit',
    ],
  },
];

export const SAFETY_LIVE_LINK = 'https://bit.ly/ttrpgsafetytoolkit';
