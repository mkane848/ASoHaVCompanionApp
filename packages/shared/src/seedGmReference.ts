import type { GmReferenceSection } from './types.js';

/** The ruleset's GM chapter as reference sections (revised V0.6 slice 8): "Running the Game", "GM
 *  Principles", "GM Moves" and "Soft & Hard Moves", verbatim from Ruleset-V0.6.md. Its own file
 *  because it is long prose that nothing else in `seedLibrary.ts` needs to scroll past. See
 *  `GmReferenceSection` for the `Body` format. */
export const GM_REFERENCE: GmReferenceSection[] = [
  {
    Id: 'gmr-running',
    Name: 'Running the Game',
    Body: `Always say

- What the Principles demand
- What the rules demand
- What your Prep demands
- What the Fiction demands
- What Honesty demands
  - Don’t hide stuff from them Heroes would know as a “gotcha”

What You Actually DO

- Frame Scenes. Call Action and Cut.
  - Control pace
- Fiction over realism.
  - Don't worry about if every detail lines up - if everyone is having fun and the story feels exciting, you’re doing it right.
- Portray the World and the NPCs truthfully.
  - How would the world and its people, with their goals in mind, respond to the events of the story?
  - What would the consequences of the Heros’ actions really be?
- Let players help with all of this as much as they and you want them to.
  - The world and story will be more engaging to everyone if everyone has a hand in crafting it. The more collaborative you can be, the more invested everyone at the table is going to be.
    - Telling the players all about the politics and gods of your world is fine, but they are MUCH more likely to care about those things if they had a hand in deciding what they were in the first place.
  - Let players tell YOU who runs this shop, or is the attendant to the duchess. Let them suggest where we start this next scene or what details are true about a location.
  - Let them add to the already established truths to move the story in interesting directions. If a Hero is a weapons master and is asking you, portraying a blacksmith NPC in a wealthy city, if they spot any blades of note, you might ask them! “You’re the weapons master, you tell me what you spot.” This instantly gets the players thinking and excited and feeling like true co-authors.
- Ref the rules and be chill about it.
  - Don’t belabor rulings or rules. You, as the GM, do have final say, but listen to your players - put yourself in their position when they have a question or difference of opinion. When in doubt, don’t think of yourself as the absolute arbiter - think of yourself as a chairperson among equals. Encourage discussion rather than making black and white judgement calls.
  - Most of the time, you’ll just be adjudicating whether or not a roll is needed or if something just happens.
    - Only roll when consequences are at stake. If failure wouldn’t change the stakes of the fiction, it just happens - you and your players can describe how it does so.
    - A good way to judge this is to be conscious of the Banes and Boons at play. What is the situation your Heroes are in?
      - Is there time pressure? Are they being stalked? Do they have the favor of the mayor of this village and can act openly?
      - Use those Banes and Boons actively - even having your players suggest them for each other, so that you always have a finger on the current situation.
  - You are here to facilitate the rules, not impose ultimate judgement.
- Plan just enough.
  - Create your locations, NPCs, secrets, countdown, etc. But then leave it alone! Leave space to discover. Because really, the only thing you are “in control” of, 100%, is the very first scene of any session. After that, the first moment you ask the Heroes what they do, the story is shared and every choice you make is going to be reacting to choices they make and round and round it goes. It is nice to have tools in your belt prepped and ready, but always leave room for discovery and to play to see what happens and where your story goes.
- Story Over Rules. Always.
  - Figure out what you are trying to make happen in a scene, moment, arc, Adventure, or session and let that be your guide. The rules are here to support you, but don’t let them get in the way of you and your friends’ fun.
  - Don’t let the rules get in the way of what makes sense within the fiction for your story and characters. If something in this text doesn’t quite gel with the moment, ignore it!! Having a memorable story or character moment that builds on what came before is much more important than following the rules.
- Make failure fun. Honestly, you’re doing your job if players look forward to failing. Sure, they mark Potential, but more than that, when a Hero fails, the players should know that something really fun to play is happening.
  - Make it clear you aren’t here to punish them. Failing isn’t “losing.” Not at all! Failure is moving the game forward, just as much as success is - just with more unknown. Which can often be even more exciting!
  - Heroes shouldn’t look like absolute fools (at least all the time) when they fail. Failure doesn’t even need to be their fault - the world around them is at play when failure happens. Something could go terribly wrong outside of their control and it forces the story forward in ways no one could have expected.
    - Say a Hero is opening a portal to bring forth an Ally, and they fail their Invoke Expertise roll. Instead of them “failing” at a task we all know they are good at, perhaps an Enemy NPC can interfere with the spell, and now it is bringing forth a monster from the Abyssal Plane! We’ve taken a moment of failure and turned it into a moment of conflict that introduces new stakes and something exciting to deal with.
- Remember that mixed successes are still successes but at a cost. Don’t forget either side of that. On a 7-9, the Hero still gets what they sought before they made the roll. It is a win! And now you, as the GM, get to introduce some wrinkle into that win. There’s a string attached. A cost.
  - The lock opens, the Heroes are in, but the alarm triggers.
  - You find the roguish contact you had heard of to get you into the black market auction. The only thing is, you didn’t know she'd be your sister-in-law.
  - You clear the chasm, sailing over it, no problem. On the other side, you look down and catch a glimpse of something falling. It fell from your bag - what was it?
- If you are having trouble coming up with a consequence for any roll, consult the player who missed the roll. Just like collaborating on the world, inviting a player to decide their own fate can be exciting. You’ll be surprised how exciting a player will be about putting their Hero in a compromising position. Fighting out of the conflict is why we’re here after all!
  - Frame this as something you are letting them in on, not forcing them to do. It is collaborative, not a punishment for “losing.”
- If the Heroes succeed against impossible odds - let them. The Big Bag Evil Guy is finally about to succeed on the next step of their big plan, but the Heroes end up rolling super well and squashing it in one session or one scene even. Let them. Really, just let them. The players don’t know they’ve “ruined” something. In fact, they feel AWESOME. Look what they just did! Let them have their moment. Reward them for being the amazing Heroes that they are. And maybe, just maybe, take the big thing you had planned and simply save it for a later consequence. Nothing is wasted and the Heroes still get to feel heroic.
  - In fact, in moments like this, it's often better to lean IN to their successes. Make them feel amazing for doing well - narrate extraordinary feats or, even better, allow them to take the reigns and show everyone what they are made of.`,
    Order: 1,
  },
  {
    Id: 'gmr-principles',
    Name: 'GM Principles',
    Body: `- Yes, and
- Let players drive the story forward
- Play to find out what happens
- Foreshadow big consequences, threats, and bad stuff
- Be a fan of the Heroes.
- Make the Heroes look, well, heroic!
- Describe things like an epic fantasy movie or book.
- Address the Heroes not the players.
- Make the threats and consequences real.
- Make smart enemies retreat.
- Treat sentient life as meaningful.
- Make the Villains goals sympathetic.
- Ask the direct questions and build the fiction from those answers.
- Think of what is happening off-screen
- Be honest with your players when you aren’t sure.
- Give the Heroes reasons to Adventure.
- Use the GM Moves or similar actions, but never call out their names.
- Build and track the world building of what your table creates and be consistent to it (unless it is cooler not to).
- Nothing is too safe. Let people die, places fall, Enemies be slain.
- Make the world feel lived in; a place they want to protect, to call home.
- Give the Heroes what they deserve, for good or bad.
- Sometimes, let the players decide what happens to the Heroes.
- Threats lurk around every corner, so the slow moments of hearth and home feel truly special.`,
    Order: 2,
  },
  {
    Id: 'gmr-moves',
    Name: 'GM Moves',
    Body: `These are suggestions. GMs are participating in a conversation in a way that feels best to them. Introducing stakes that make sense for their table and the story being told there. Nobody needs to remember all the GM moves. You’re never going to say “ I am making this specific GM Move!”

Don’t feel the need to have them prepped somewhere (unless that really, really helps you). Just read them once, get the gist of what GMs do in this game and then go on your own way. We’ve provided some suggested GM moves that will help you run this game, and some details on each one:

- Frame a scene in the middle of the action
- Slow the pace down and frame explicit lack of dangers afoot
- If there is no good consequence, or reason for a consequence, give the heroes what they want - maybe with strings attached or a cost
- Soft move (set up an immediate danger)
- Decide if a move triggers or if whatever happens just happens
- Make the heroes choose between two good things - making them sacrifice the other
- Change the setting
- Increase the stakes of a scene
- Foreshadow some future villainy, threat, or other badness either subtly or directly
- Reveal something happening off screen
- Tell them what the consequences of their actions will be and see if they want to go through with it - basically, a warning
- Require a cost to get what they need/want
- Inflict strain/condition/do them literal harm
- Advance the Countdown
- Advance a Threat Clock
- Take something from them
- Put an innocent NPC in danger.
- Make them find a MacGuffin
- Turn their move back on them.
  - Works well when they miss. When they try to make a move, have the NPC make that same move back at them.
- Split them up
- Bring them together
- Have something backfire
- Have NPCs come to the wrong conclusions and make a decision that they think is best for them.
- Show the cost of their actions (or inactions). Even victory has its consequences sometimes.
- Have your Villain make one of their moves.
- Turn a miss back on them. Whatever they were trying to do - something of the opposite happens.
- Always ask, after making any move what the Heroes do next

Remember: to do it, do it. Say what is actually happening, don’t just state the rule. We need to show each other the action, not just tell each other the rule or move. You have to describe what your character or NPC actually does.`,
    Order: 3,
  },
  {
    Id: 'gmr-soft-hard',
    Name: 'Soft & Hard Moves',
    Body: `Outside of Combat, in Narrative play, we have Soft and Hard Moves.

Soft Moves are basically setups or prompts for the players. A lot of times when you ask “What do you do” you are setting up a Soft Move. A Soft Move *threatens* danger or pushes the Heroes to make a choice, but there is always going to be time for them to stop or divert the bad stuff.

A Soft Move is like, “as you make your way through the ancient, dwarven ruins, you begin to hear hushed voices from around the corner, what do you do?”

In this case you aren’t having those voices actually *do* anything to the Heroes without allowing them a chance to make the first move. Making Soft Moves gifts your players agency in how they want to act. You can even do this when situations are more tense.

“You all stand on the road facing the knuckledusters. These bandits don’t seem to be asking for a toll, their faces are hungry; angry. The woman in the middle, who seems to be their leader, flips a dagger in her hand and makes eye contact with you. She looks like the wrong move will set her off. What do you do?”

In this case, there is clear and present danger, but even still, the Heroes have a chance to take actions.

Hard Moves go a step further. A Hard Move doesn’t give the Heroes time to react.

When you make a Hard Move you are afflicting the Heroes with some tangible penalty. That penalty might be in the fiction itself - separated from each other, a portal they thought was going one place actually leads to another; it also might be directly harmful to them - having them mark Strain or a Condition.

A player isn’t reacting to the possibility of consequences with a Hard Move, like they do with a Soft Move, they are reacting to actual consequences. After a Hard Move, the stakes have meaningfully changed.

Most of the time, in the conversation of the game, you will be setting up Soft Moves. In fact, you should use Soft Moves to telegraph situations that may lead to a Hard Dove. A Soft Move introduces or evolves a situation where the Heroes have something to deal with. If they surpass that problem, that’s great. If something goes awry (like a missed roll), then a good follow-up on the GM’s end would be for them to spend a Misfortune to use a Hard Move.

In order to use a Hard Move you, as the GM, must spend a Misfortune. You’ll always start a Session with at least 1 and you gain one any time a player makes a roll of 6 or less.

Sometimes, you'll spend that Misfortune and make a Hard Move without first setting it up with a Soft Move, catching the Heroes off guard. The simple notion of Misfortune existing as a currency will do a lot of work of making that “feel” fair, but also you can make those Hard Moves feel exciting to the players by using them whenever the Heroes hand you a golden opportunity to do so or when they miss any Hero Roll.

A golden opportunity would look something like a Hero charging head first, through a locked door, into the evil warlock’s ritual chamber, where he was audibly casting a spell. Sure, they succeed on their roll to bust through the door, but now look where they are! Spend that Misfortune and have the Warlock trap them in the spell circle at the entrance to the room.`,
    Order: 4,
  },
];
