import Link from 'next/link'

const sectionIds = {
  intro: 'intro',
  neuralNetwork: 'what-is-a-neural-network',
  howNetworksWork: 'how-neural-networks-work',
  keyTerms: 'key-terms',
  experimentNetworks: 'how-experiment-implements-networks',
  petriDish: 'why-petri-dish',
  organisms: 'what-are-organisms',
  brainsMotivations: 'brains-and-motivations',
  whyTheyAct: 'why-they-act',
  methodology: 'methodology',
  gameTheoryNash: 'game-theory-nash',
  nashDetectionTechnical: 'nash-detection-technical',
  gpuWorkers: 'gpu-workers',
  measuring: 'what-we-measure',
  aiFuture: 'ai-future',
} as const

const tocItems: { id: string; label: string }[] = [
  { id: sectionIds.neuralNetwork, label: 'What is a neural network?' },
  { id: sectionIds.howNetworksWork, label: 'How do neural networks work?' },
  { id: sectionIds.keyTerms, label: 'Key terms' },
  { id: sectionIds.experimentNetworks, label: 'How does this experiment implement neural networks?' },
  { id: sectionIds.petriDish, label: 'Why did we choose a petri dish?' },
  { id: sectionIds.organisms, label: 'What are the organisms?' },
  { id: sectionIds.brainsMotivations, label: 'How do their brains work and what are their motivations?' },
  { id: sectionIds.whyTheyAct, label: 'Why do they act the way they do?' },
  { id: sectionIds.methodology, label: 'How do we conduct the experiment?' },
  { id: sectionIds.gameTheoryNash, label: 'Game theory and Nash equilibrium' },
  { id: sectionIds.nashDetectionTechnical, label: 'How we detect Nash equilibrium (technical)' },
  { id: sectionIds.gpuWorkers, label: 'Why do we need GPU workers?' },
  { id: sectionIds.measuring, label: 'What are we measuring?' },
  { id: sectionIds.aiFuture, label: 'Why is this relevant for the future of AI?' },
]

function SectionCard({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 md:p-8 shadow-sm"
    >
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-600">
        {title}
      </h2>
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-4 text-base md:text-lg">
        {children}
      </div>
    </section>
  )
}

export default function OverviewPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-10 md:space-y-12">
        {/* Page title and intro */}
        <header id={sectionIds.intro} className="scroll-mt-24">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Experiment Overview
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">
            This page explains the EvoNash experiment in plain language: what we do, why we do it,
            and how it connects to game theory, neural networks, and the future of AI. No prior
            background is required.
          </p>
        </header>

        {/* Comprehensive opening: project summary for science fair (grade 9) */}
        <section className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-2 border-b border-gray-200 dark:border-gray-600">
            About This Project: The Science Fair Experiment at a Glance
          </h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-6 text-base md:text-lg">
            <p>
              <strong>EvoNash</strong> is a science fair project that asks a simple question: if we
              let digital &quot;organisms&quot; with tiny artificial brains evolve in a mini world,
              does it help to change their &quot;genes&quot; more when they are doing poorly and
              less when they are doing well? Or is it better to always change them by the same
              amount, like flipping a coin the same way every time? This project builds a real
              experiment—a computer platform that runs on a powerful graphics card—to answer that
              question. Below we explain every part of the experiment in simple terms.
            </p>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Abstract (What We Did in One Paragraph)
              </h3>
              <p>
                This experiment tests whether <strong>adaptive mutation</strong>—changing an
                organism&apos;s &quot;genes&quot; (the numbers inside its brain) more when the
                parent did poorly and less when the parent did well—helps a population of 1,000
                digital organisms reach a <strong>stable outcome</strong> (called a Nash
                equilibrium) faster than a <strong>control group</strong> that always uses the same
                amount of random change (static mutation). We put the organisms in a simple 2D
                world (a &quot;petri dish&quot;) where they can move, eat food, and shoot at each
                other to steal energy. Their brains are small neural networks that we do not
                program; we only evolve them by keeping the best performers and randomly mutating
                their weights. We run two groups side by side, measure how many generations it
                takes each group to &quot;settle down,&quot; and use statistics to see if the
                adaptive group really got there faster. The results tell us whether this kind of
                smart mutation could help future AI and evolutionary algorithms.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                The Problem (Why We Did This)
              </h3>
              <p>
                In many real-world and computer experiments, we use <strong>evolution</strong> to
                improve things: we keep the best performers, copy them with small random changes
                (mutations), and repeat. But how much should we change them? If we change too much
                every time, good solutions get destroyed and we search almost at random. If we
                change too little, we might get stuck in a &quot;local&quot; good outcome and never
                find a better one. Most classic methods use a <strong>fixed</strong> amount of
                mutation—the same for everyone, every time. This project asks: what if we
                <strong> adapt</strong> the amount of mutation to how well the parent did?
                Struggling organisms get more random changes (a chance to try something new);
                successful ones get fewer changes (we keep what works). We wanted to test whether
                that idea actually speeds up how fast a population finds a stable, balanced outcome
                (a Nash equilibrium) in a simple but real experiment.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                The Hypothesis (What We Think Will Happen)
              </h3>
              <p>
                Our <strong>hypothesis</strong> is: if we use adaptive mutation—where the amount
                of random change is <strong>inversely proportional</strong> to the parent&apos;s
                fitness (so low-performing parents produce more heavily mutated offspring, and
                high-performing parents produce less mutated offspring)—then the population will
                reach a Nash equilibrium (a stable mix of strategies where no one benefits by
                changing alone) in <strong>fewer generations</strong> than a control group that
                uses a fixed mutation rate. In other words, we predict that &quot;smarter&quot;
                mutation will help the population settle down faster.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Methodology (How We Run the Experiment)
              </h3>
              <p>
                We run <strong>two groups</strong> of experiments. Everything is the same in both
                groups except one thing: <strong>how much we mutate</strong> the offspring. In the
                <strong> control group</strong>, we always add the same small random amount of
                change to the brain weights (static mutation). In the <strong>experimental
                group</strong>, we add more change when the parent had a low rating (Elo) and less
                change when the parent had a high rating (adaptive mutation). For each group we:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Start with 1,000 random neural-network &quot;brains&quot; in the same petri dish world.</li>
                <li>Let them live for many &quot;ticks&quot; (moments)—moving, eating food, and sometimes shooting each other—and track who has the most energy.</li>
                <li>At the end of each generation, we pick the top 20% by rating (Elo), copy their brains to create offspring, and mutate those copies (more or less depending on the group).</li>
                <li>We repeat for many generations until the population&apos;s behavior <strong>stabilizes</strong>—meaning the mix of strategies stops changing much (we call that reaching Nash equilibrium).</li>
                <li>We record <strong>when</strong> that happened (which generation) and <strong>how well</strong> the population did (peak rating).</li>
              </ul>
              <p className="mt-2">
                Then we <strong>compare</strong> the two groups using statistics: did the
                adaptive-mutation group reach Nash equilibrium in fewer generations? If yes, that
                supports our hypothesis.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Variables (What We Change, What We Measure, What We Keep the Same)
              </h3>
              <p>
                In any good experiment we control what we change and what we measure. Here:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>What we change (independent variable):</strong> The mutation strategy—fixed (control) vs adaptive (experimental).</li>
                <li><strong>What we measure (dependent variables):</strong> (1) How many generations it took to reach Nash equilibrium (our main outcome), and (2) how high the population&apos;s rating got (peak fitness).</li>
                <li><strong>What we keep the same (constants):</strong> Population size (1,000), the rules of the petri dish (physics, food, shooting), how we select parents (top 20%), and the shape of the neural network (24 inputs, 64 hidden neurons, 4 outputs). Keeping these the same lets us fairly compare the two mutation strategies.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Why This Matters
              </h3>
              <p>
                This project combines <strong>evolution</strong> (trial and error over
                generations), <strong>game theory</strong> (Nash equilibrium—when no one benefits
                by changing strategy alone), and <strong>neural networks</strong> (small artificial
                brains). Understanding whether adaptive mutation speeds up convergence can help
                future AI and evolutionary algorithms—for example, in robotics, multi-agent
                systems, or automated design. The rest of this page explains each part of the
                experiment in more detail, so you can understand exactly what we did and why.
              </p>
            </div>
          </div>
        </section>

        {/* Table of contents */}
        <nav
          aria-label="Table of contents"
          className="bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
            Contents
          </h2>
          <ul className="space-y-2">
            {tocItems.map(({ id, label }) => (
              <li key={id}>
                <Link
                  href={`#${id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Section 1: What is a neural network? */}
        <SectionCard id={sectionIds.neuralNetwork} title="What is a neural network?">
          <p>
            A <strong>neural network</strong> is a computer model inspired by how brain cells
            work. It is made of many simple &quot;cells&quot; (called neurons) that receive
            numbers, do simple math, and send numbers to other cells. No one programs the network
            step-by-step to solve the problem. Instead, we give it a structure—layers and
            connections—and then we <strong>change the strength of those connections</strong> (the
            &quot;weights&quot;) through learning or, in our case, evolution.
          </p>
          <p>
            Think of it like a recipe where we only adjust the amounts of ingredients, not the
            steps. In this experiment, each organism&apos;s &quot;brain&quot; is one small neural
            network. It is nothing like a human brain in size or complexity, but the same basic
            idea: numbers go in, math happens, and numbers come out that become actions.
          </p>
        </SectionCard>

        {/* Section 2: How do neural networks work? */}
        <SectionCard id={sectionIds.howNetworksWork} title="How do neural networks work?">
          <p>
            The <strong>inputs</strong> are numbers that represent what the organism
            &quot;knows&quot;—for example, how far away the nearest food is, or how close the
            nearest wall or other organism is. These numbers flow through <strong>layers</strong>.
            The first layer takes the inputs and multiplies them by learned &quot;weights,&quot;
            adds &quot;biases,&quot; and then applies a simple rule (like &quot;if the result is
            negative, treat it as zero&quot;) so the network can learn patterns that are not
            straight lines. The result becomes the input to the next layer, and so on.
          </p>
          <p>
            The <strong>output layer</strong> produces the final numbers. In our experiment, that
            is four numbers that control thrust, turn, shoot, and split (see Key terms below). The
            only thing that changes during evolution is the weights and biases; the layout of the
            network stays the same. If the first weight is big, that input has a big effect on the
            next layer; if it is small, it has a small effect.
          </p>
        </SectionCard>

        {/* Section 2a: Key terms */}
        <SectionCard id={sectionIds.keyTerms} title="Key terms">
          <p className="mb-6">
            The following terms are used throughout this overview. They are defined here so you can
            refer back anytime.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Raycasts
              </h3>
              <p>
                &quot;Raycast&quot; is not a common word—it comes from computer graphics. In this
                experiment, <strong>raycasts</strong> are virtual beams or sensors. The organism
                sends out 8 &quot;beams&quot; in different directions (like headlights or radar).
                Each beam reports how far the nearest wall, food pellet, or other organism is (and
                sometimes the size of the other organism). So the organism does not
                &quot;see&quot; pictures; it gets 24 numbers (8 directions × 3 types of distance).
                Imagine shooting a beam of light in one direction and it tells you how many steps
                until you hit a wall, food, or another creature—that is one raycast.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                The four actions
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Thrust</strong> — The strength of &quot;move forward,&quot; from 0 (don&apos;t
                  move) to 1 (full power). The organism accelerates in the direction it is facing.
                </li>
                <li>
                  <strong>Turn</strong> — Rotate left or right, from -1 to 1. It changes which
                  direction the organism is facing.
                </li>
                <li>
                  <strong>Shoot</strong> — Fire a projectile. If it hits another organism, the
                  shooter steals some of their energy (that is predation). There is a
                  <strong> cooldown</strong>: after shooting, the organism must wait a short time
                  before it can shoot again.
                </li>
                <li>
                  <strong>Split</strong> — Another action with a cooldown; it can be used for
                  reproduction or other abilities in the simulation.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Moving</h3>
              <p>
                <strong>Moving</strong> in the experiment is the result of thrust and the
                simulation&apos;s physics. Each moment (each &quot;tick&quot;), the
                organism&apos;s velocity is updated by its thrust, and its position is updated by
                its velocity. So moving = thrust + physics; the organism does not teleport.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Elo (in depth)
              </h3>
              <p>
                <strong>Elo</strong> is a rating system invented for chess (by Arpad Elo) that
                estimates how strong a player is from their wins and losses. In our experiment,
                each organism has an Elo rating (a number). We start everyone at 1500; over time,
                the number goes up if they tend to &quot;win&quot; and down if they tend to
                &quot;lose.&quot;
              </p>
              <p>
                We do not play full chess games. After each <strong>generation</strong> (one round
                of life in the petri dish), we run many short &quot;matches&quot; between random
                pairs of organisms. In each match we ask: who had more energy at the end of the
                generation? That organism &quot;wins&quot; (score 1), the other &quot;loses&quot;
                (score 0); if they had the same energy, it is a tie (0.5). Then we update both
                organisms&apos; Elo ratings. If you beat someone you were &quot;expected&quot; to
                lose to, your rating goes up more; if you lose to someone you were expected to
                beat, it goes down more. Over many matches, Elo reflects who tends to do better in
                the petri dish.
              </p>
              <p>
                We use Elo to select parents (top 20% by rating get to reproduce), to set mutation
                rate in the experimental group (low Elo = more mutation, high Elo = less), and to
                measure how well the population did (peak Elo = highest rating anyone reached). So
                Elo is the fitness measure that drives evolution and our statistics.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Other terms
              </h3>
              <p>
                <strong>Tick</strong> — One moment or step in the simulation (like one frame in a
                video). <strong>Generation</strong> — One full round of life, then selection,
                breeding, and mutation. <strong>Cooldown</strong> — A wait time before an action
                (e.g. shoot) can be used again. <strong>Metabolism</strong> — The organism losing
                a little energy every tick (like burning calories). <strong>Foraging</strong> —
                Getting energy by eating food pellets. <strong>Predation</strong> — Getting energy
                by shooting another organism and stealing their energy.                 <strong>Policy
                entropy</strong> — A number that measures how &quot;mixed&quot; or
                &quot;certain&quot; one organism&apos;s decisions are (averaged over the population
                we get mean policy entropy). <strong>Entropy variance</strong> — How much
                organisms differ from each other in that &quot;mixed vs certain&quot; measure;
                when it is low and stable, the population has settled on a similar mix of
                strategies (we use this to detect Nash equilibrium). <strong>Convergence</strong> —
                The population settling into a stable mix of strategies (Nash equilibrium). <strong>Fitness</strong> —
                How well an organism did; we use Elo as our fitness measure. <strong>Weights</strong> —
                The numbers inside the neural network that get evolved. <strong>Mutation</strong> —
                Randomly changing those weights a little when creating offspring.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Section 3: How does this experiment implement neural networks? */}
        <SectionCard
          id={sectionIds.experimentNetworks}
          title="How does this experiment implement neural networks?"
        >
          <p>
            Each organism has exactly one neural network as its brain. That network has 24 inputs
            from raycasts (virtual beams in 8 directions that report how far the nearest wall,
            food, or other organism is). It has one hidden layer of 64 neurons—a middle layer that
            mixes the 24 inputs into 64 new numbers, giving the network room to learn patterns. It
            has 4 outputs: thrust (move forward), turn (rotate), shoot (fire a projectile to steal
            energy from others), and split (see Key terms).
          </p>
          <p>
            We run 1,000 organisms at once. To do this quickly we use a graphics card (GPU) to run
            all 1,000 brains in parallel—like having 1,000 calculators working at the same time.
            The software runs on the GPU so we can simulate many generations in a reasonable time.
          </p>
        </SectionCard>

        {/* Section 4: Why did we choose a petri dish? */}
        <SectionCard id={sectionIds.petriDish} title="Why did we choose a petri dish?">
          <p>
            The <strong>petri dish</strong> is our controlled mini-world for the experiment. Think
            of a real petri dish in biology: a simple, closed environment where we can watch life
            (here, digital organisms) under fixed rules. That helps science because we can repeat
            the experiment exactly—same rules, same starting conditions—and change only one thing:
            how much we mutate the &quot;genes&quot; (weights) of the neural networks. So we can
            fairly compare two strategies.
          </p>
          <p>
            The world is 2D (flat, like a tabletop) and continuous (organisms can be anywhere,
            not just on a grid), with wrap-around borders: going off one edge brings you back on the
            other side, so there are no corners to get stuck in. The physics are simple (movement
            and collisions) so the computer can simulate thousands of organisms without extra
            complexity. The petri dish is our lab bench—simple, repeatable, and designed so we can
            learn about evolution and mutation, not about the environment.
          </p>
        </SectionCard>

        {/* Section 5: What are the organisms? */}
        <SectionCard id={sectionIds.organisms} title="What are the organisms?">
          <p>
            The <strong>organisms</strong> (also called agents) are digital creatures represented
            as circles moving in the 2D petri dish. Each has <strong>energy</strong>—like health or
            fuel. They lose a little energy every moment (metabolism, like burning calories just to
            stay alive) and gain energy in two ways: by eating food (static pellets that give a set
            amount of energy) or by predation (shooting a projectile at another organism to steal
            some of their energy).
          </p>
          <p>
            Foraging is safer but can be slow; predation is riskier but can yield big gains. They
            have no hands or eyes; their only &quot;senses&quot; are the numbers from the raycasts
            and their own state, and their only &quot;actions&quot; are the four outputs (thrust,
            turn, shoot, split). No one programmed them to &quot;go toward food&quot; or
            &quot;avoid enemies&quot;—they only have a brain (neural network) that turns what they
            sense into actions. Over time, organisms that keep their energy high survive and
            reproduce; others die out.
          </p>
        </SectionCard>

        {/* Section 6: Brains and motivations */}
        <SectionCard
          id={sectionIds.brainsMotivations}
          title="How do their neural network brains work and what are their motivations?"
        >
          <p>
            Each moment (tick), every organism gets a list of 24 numbers: from 8 directions, how
            far to the nearest wall, food, and enemy (and sometimes enemy size), plus a few
            numbers about itself (energy level, speed, whether it is on cooldown for shooting or
            splitting). That list is the input to its neural network. The network outputs 4 numbers
            that control thrust, turn, shoot, and split.
          </p>
          <p>
            No one programmed the organisms to &quot;go toward food&quot; or &quot;avoid
            enemies.&quot; The network just has weights that get evolved; any &quot;strategy&quot;
            we see (foraging, fleeing, attacking) emerges from which organisms had more offspring.
            So their motivation is not written in code; it is implicit: organisms that by chance
            behave in ways that keep energy high get to reproduce, so over many generations the
            population tends to act in ways that help survival. We measure their success with a
            rating called Elo (see Key terms)—higher Elo means they tend to &quot;win&quot; more
            often in our pairwise comparisons. Think of it like nature selecting the best
            survivors.
          </p>
        </SectionCard>

        {/* Section 7: Why do they act the way they do? */}
        <SectionCard id={sectionIds.whyTheyAct} title="Why do they act the way they do?">
          <p>
            We do not tell the organisms how to behave. We only select the best performers (top
            20% by rating), copy their neural network weights to create offspring, and randomly
            change (mutate) those weights a little. So &quot;why they act the way they do&quot; is:
            their brains were shaped by many generations of trial and error.
          </p>
          <p>
            Organisms that happened to have weights that led to good survival and reproduction left
            more copies; bad strategies died out. It is like breeding dogs for speed—we did not
            design the legs; we just kept the fastest and over time they got faster. At the start,
            behavior is almost random; after many generations we often see recognizable strategies
            (some organisms forage, some attack) because those strategies won in the petri dish.
            They act the way they do because evolution favored those behaviors in this environment.
          </p>
        </SectionCard>

        {/* Section 8: Methodology */}
        <SectionCard id={sectionIds.methodology} title="How do we conduct the experiment?">
          <p>
            We run two groups of experiments, identical in every way except how much we mutate the
            offspring.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Control group</strong> — We use a fixed mutation amount (we always change the
              weights by the same small random amount), like flipping a coin the same way every
              time.
            </li>
            <li>
              <strong>Experimental group</strong> — We use adaptive mutation: we change the weights
              more when the parent did poorly and less when the parent did well. Struggling
              organisms get more random changes (more chance to try something new); successful ones
              get fewer changes (we keep what works).
            </li>
          </ul>
          <p>
            For each group we start with 1,000 random neural networks, run the petri dish for many
            generations (each generation = one round of life, selection, breeding, and mutation),
            and we stop when the population&apos;s behavior stabilizes—meaning the mix of
            strategies stops changing much. We call that approaching a Nash equilibrium (see next
            section). We record when that happened (which generation) and how well the population
            did (peak rating). Then we compare the two groups: did the adaptive-mutation group
            reach stability faster? We use statistics to check if the difference is real or just
            luck.
          </p>
        </SectionCard>

        {/* Section 8a: Game theory and Nash equilibrium */}
        <SectionCard
          id={sectionIds.gameTheoryNash}
          title="What is game theory? What is Nash equilibrium? Why is it the key metric?"
        >
          <p>
            <strong>Game theory</strong> is the study of situations where multiple
            decision-makers (players) choose actions, and each person&apos;s outcome depends not
            only on their own choice but on what others do. Think of two people dividing a pizza: if
            you ask for more, the other might take less; your best choice depends on what you think
            they will do. In our experiment, the &quot;players&quot; are the organisms. Each one
            chooses how to behave (forage, attack, flee) based on its neural network, and its
            success (energy, survival, reproduction) depends on what the other 999 are doing. So the
            petri dish is a &quot;game&quot; in the game-theory sense.
          </p>
          <p>
            <strong>Nash equilibrium</strong> is a situation where no one can improve their outcome
            by changing their strategy alone, given what everyone else is doing. It is named after
            the mathematician John Nash. At a Nash equilibrium, if you are the only one who
            switches from &quot;forage&quot; to &quot;attack,&quot; you don&apos;t do better—so no
            one has a reason to switch. It describes a stable outcome: everyone is doing the best
            they can given what others do.
          </p>
          <p>
            In our experiment, each organism has a strategy (the way its brain turns inputs into
            actions). The population has a mix of strategies. We say the population has reached a
            Nash-like equilibrium when the mix of strategies stops changing from generation to
            generation: the kinds of behavior have settled into a stable balance. At that point, no
            organism would do better by behaving differently, given how the rest of the population
            is behaving. We detect this by watching <strong>entropy variance</strong>—how much
            the organisms differ from each other in how &quot;mixed&quot; or &quot;certain&quot;
            their decisions are. When everyone is behaving similarly, that difference drops and
            stays low; when it stays low for many generations in a row, we treat that as having
            reached Nash equilibrium.
          </p>
          <p>
            <strong>Why Nash equilibrium is the key metric:</strong> Our hypothesis is that
            adaptive mutation helps the population reach Nash equilibrium faster than fixed
            mutation. So the key metric is how many generations it takes to reach Nash
            equilibrium—that is our primary outcome. If the adaptive-mutation group reaches Nash
            equilibrium in fewer generations than the control group, that supports the hypothesis.
            Nash equilibrium is not just a fancy name for &quot;they settled down&quot;—it is the
            specific, stable outcome from game theory that we use to define &quot;settled,&quot; and
            the generation at which we reach it is the main number we use to test our hypothesis.
          </p>
        </SectionCard>

        {/* Section 8b: Nash equilibrium detection (technical / experiment methodology) */}
        <SectionCard
          id={sectionIds.nashDetectionTechnical}
          title="How we detect Nash equilibrium (technical)"
        >
          <p>
            <strong>Detection criterion.</strong> Nash equilibrium is detected using
            <strong> entropy variance</strong> across the population, not mean policy entropy.
            For each generation we compute a scalar <strong>policy entropy</strong> per agent
            (expected entropy of the action distribution over a fixed set of sample inputs).
            The <strong>entropy variance</strong> is the variance of those per-agent entropies
            across the population.
          </p>
          <p>
            <strong>Why variance rather than mean entropy.</strong> Mean policy entropy
            indicates how mixed or deterministic the average policy is, but it does not
            measure population-level homogeneity. At equilibrium we require that the
            strategy mix has stabilized—i.e., that agents no longer differ substantially
            in behavior. That corresponds to low <em>variance</em> of policy entropy across
            agents: when all agents have similar entropies, the population has converged
            to a homogeneous strategy mix. We therefore define convergence as the
            generation at which entropy variance falls below a threshold and remains
            below it for a fixed stability window (after an initial phase of
            divergence), with a post-convergence buffer to confirm stability.
          </p>
        </SectionCard>

        {/* Section 9: GPU workers */}
        <SectionCard id={sectionIds.gpuWorkers} title="Why do we need GPU workers?">
          <p>
            We have 1,000 organisms, each with a neural network that does many multiplications every
            moment, and we run hundreds of generations. Doing that on an ordinary computer (CPU)
            would take a very long time—hours or days. A GPU (graphics card) is built to do
            thousands of simple math operations at once (originally for drawing graphics). We use
            it to run all 1,000 brains in parallel—like having 1,000 people each do one
            multiplication at the same time instead of one person doing 1,000.
          </p>
          <p>
            <strong>Workers</strong> are the computers that have the GPU and actually run the
            simulation. The website you see is the &quot;controller&quot;; it sends the experiment
            settings to a worker, the worker runs the petri dish and evolution on its GPU, and
            sends the results back. So we need GPU workers to finish the experiment in a reasonable
            time and to separate the heavy computation (worker) from the interface and storage (web
            app). Think of the worker as a lab technician who runs the experiment and mails back
            the data.
          </p>
        </SectionCard>

        {/* Section 10: What are we measuring? */}
        <SectionCard id={sectionIds.measuring} title="What are we measuring?">
          <p>
            The <strong>primary</strong> metric for proving our hypothesis is how many generations
            it takes to reach Nash equilibrium (convergence velocity). The other metrics (peak
            fitness, policy entropy) support the analysis, but convergence to Nash is the key
            outcome we compare between the two groups.
          </p>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>Convergence velocity</strong> (&quot;when did they reach Nash
              equilibrium?&quot;) — We record the generation number at which the population&apos;s
              behavior becomes stable: the variety of strategies (who forages, who attacks) stops
              changing much from generation to generation. We check this using <strong>entropy
              variance</strong>—how much the organisms differ from each other in how mixed or
              certain their decisions are. When that difference is small and stays small for many
              generations, everyone is behaving similarly and we say we have reached a Nash-like
              equilibrium. So convergence velocity = how many generations it took to get there.
              Faster convergence = fewer generations.
            </li>
            <li>
              <strong>Peak fitness</strong> (&quot;how good did they get?&quot;) — We record the
              highest Elo rating that any organism (or the population) reached (see Key terms for
              what Elo is and how we calculate it). This tells us how well the evolved strategies
              performed in the petri dish.
            </li>
            <li>
              <strong>Policy entropy</strong> (&quot;how predictable are one organism&apos;s
              decisions?&quot;) — This number tells us whether an organism is still experimenting
              (high entropy) or has settled on a stable style (low entropy). We look at the
              <strong> variance</strong> of that number across all organisms to detect
              equilibrium: when the variance is low, everyone is similar; when it stays low for
              many generations, we have reached Nash equilibrium.
            </li>
          </ul>
          <p>
            We are measuring how fast the population stabilizes and how well it does, and we
            compare these between the control and experimental groups.
          </p>
        </SectionCard>

        {/* Section 11: AI future */}
        <SectionCard
          id={sectionIds.aiFuture}
          title="Why is this relevant for the future of AI, and how could it be expanded?"
        >
          <p>
            <strong>Relevance:</strong> This experiment combines evolution (trial and error over
            generations), game theory (Nash equilibrium—when no one benefits by changing strategy
            alone), and neural networks (brains that learn or evolve). That combination is useful
            for the future of AI because: (1) we can discover strategies without hand-designing
            every rule; (2) we can study many agents interacting (like robots, drones, or trading
            algorithms); (3) we can test how to evolve better—for example, does adaptive mutation
            help? So the relevance is: it is a step toward AI that improves itself through
            evolution and that can work in competitive, multi-agent worlds.
          </p>
          <p>
            <strong>Expansion:</strong> This kind of experiment could grow in many directions. We
            could use bigger or more complex worlds (e.g. 3D, more types of food or danger), more
            organisms or larger brains, different species (e.g. predators vs prey with different
            neural networks), or smarter mutation (e.g. learning how much to mutate). We could also
            apply similar methods to real-world applications: training robot swarms, designing fair
            markets, or testing policies in simulations. The goal is to show that evolutionary
            game-theoretic experiments can scale and benefit both science and industry.
          </p>
        </SectionCard>
      </div>
    </main>
  )
}
