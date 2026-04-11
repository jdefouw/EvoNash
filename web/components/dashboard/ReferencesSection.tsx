/**
 * ReferencesSection – exhaustive academic reference list for the EvoNash experiment.
 *
 * Used both as a dashboard tab and embedded at the bottom of the overview page.
 * References cover Game Theory, Neural Networks, Evolutionary Computing,
 * Adaptive Mutation, Statistics, Multi-Agent Systems, GPU Computing, and
 * Information Theory.
 */

export interface Reference {
  id: number
  authors: string
  year: string
  title: string
  source: string
  doi?: string
  url?: string
  category: string
}

export const references: Reference[] = [
  // ── Game Theory & Nash Equilibrium ──
  {
    id: 1,
    authors: 'Nash, J.F.',
    year: '1950',
    title: 'Equilibrium points in n-person games',
    source: 'Proceedings of the National Academy of Sciences, 36(1), 48–49',
    doi: '10.1073/pnas.36.1.48',
    category: 'Game Theory & Nash Equilibrium',
  },
  {
    id: 2,
    authors: 'Nash, J.F.',
    year: '1951',
    title: 'Non-cooperative games',
    source: 'Annals of Mathematics, 54(2), 286–295',
    doi: '10.2307/1969529',
    category: 'Game Theory & Nash Equilibrium',
  },
  {
    id: 3,
    authors: 'von Neumann, J. & Morgenstern, O.',
    year: '1944',
    title: 'Theory of Games and Economic Behavior',
    source: 'Princeton University Press',
    category: 'Game Theory & Nash Equilibrium',
  },
  {
    id: 4,
    authors: 'Maynard Smith, J.',
    year: '1982',
    title: 'Evolution and the Theory of Games',
    source: 'Cambridge University Press',
    doi: '10.1017/CBO9780511806292',
    category: 'Game Theory & Nash Equilibrium',
  },
  {
    id: 5,
    authors: 'Axelrod, R.',
    year: '1984',
    title: 'The Evolution of Cooperation',
    source: 'Basic Books',
    category: 'Game Theory & Nash Equilibrium',
  },

  // ── Neural Networks ──
  {
    id: 6,
    authors: 'McCulloch, W.S. & Pitts, W.',
    year: '1943',
    title: 'A logical calculus of the ideas immanent in nervous activity',
    source: 'Bulletin of Mathematical Biophysics, 5(4), 115–133',
    doi: '10.1007/BF02478259',
    category: 'Neural Networks',
  },
  {
    id: 7,
    authors: 'Rosenblatt, F.',
    year: '1958',
    title: 'The perceptron: A probabilistic model for information storage and organization in the brain',
    source: 'Psychological Review, 65(6), 386–408',
    doi: '10.1037/h0042519',
    category: 'Neural Networks',
  },
  {
    id: 8,
    authors: 'Rumelhart, D.E., Hinton, G.E. & Williams, R.J.',
    year: '1986',
    title: 'Learning representations by back-propagating errors',
    source: 'Nature, 323(6088), 533–536',
    doi: '10.1038/323533a0',
    category: 'Neural Networks',
  },
  {
    id: 9,
    authors: 'Goodfellow, I., Bengio, Y. & Courville, A.',
    year: '2016',
    title: 'Deep Learning',
    source: 'MIT Press',
    url: 'https://www.deeplearningbook.org/',
    category: 'Neural Networks',
  },

  // ── Evolutionary Computing & Neuroevolution ──
  {
    id: 10,
    authors: 'Holland, J.H.',
    year: '1975',
    title: 'Adaptation in Natural and Artificial Systems',
    source: 'University of Michigan Press',
    category: 'Evolutionary Computing & Neuroevolution',
  },
  {
    id: 11,
    authors: 'Goldberg, D.E.',
    year: '1989',
    title: 'Genetic Algorithms in Search, Optimization, and Machine Learning',
    source: 'Addison-Wesley',
    category: 'Evolutionary Computing & Neuroevolution',
  },
  {
    id: 12,
    authors: 'Stanley, K.O. & Miikkulainen, R.',
    year: '2002',
    title: 'Evolving neural networks through augmenting topologies',
    source: 'Evolutionary Computation, 10(2), 99–127',
    doi: '10.1162/106365602320169811',
    category: 'Evolutionary Computing & Neuroevolution',
  },
  {
    id: 13,
    authors: 'Salimans, T., Ho, J., Chen, X., Sidor, S. & Sutskever, I.',
    year: '2017',
    title: 'Evolution strategies as a scalable alternative to reinforcement learning',
    source: 'arXiv preprint arXiv:1703.03864',
    url: 'https://arxiv.org/abs/1703.03864',
    category: 'Evolutionary Computing & Neuroevolution',
  },
  {
    id: 14,
    authors: 'Such, F.P., Madhavan, V., Conti, E., Lehman, J., Stanley, K.O. & Clune, J.',
    year: '2017',
    title: 'Deep neuroevolution: Genetic algorithms are a competitive alternative for training deep neural networks for reinforcement learning',
    source: 'arXiv preprint arXiv:1712.06567',
    url: 'https://arxiv.org/abs/1712.06567',
    category: 'Evolutionary Computing & Neuroevolution',
  },

  // ── Adaptive Mutation & Self-Adaptation ──
  {
    id: 15,
    authors: 'Bäck, T.',
    year: '1993',
    title: 'Optimal mutation rates in genetic search',
    source: 'Proceedings of the 5th International Conference on Genetic Algorithms, 2–8',
    category: 'Adaptive Mutation & Self-Adaptation',
  },
  {
    id: 16,
    authors: 'Smith, J.E. & Fogarty, T.C.',
    year: '1997',
    title: 'Operator and parameter adaptation in genetic algorithms',
    source: 'Soft Computing, 1(2), 81–87',
    doi: '10.1007/s005000050009',
    category: 'Adaptive Mutation & Self-Adaptation',
  },
  {
    id: 17,
    authors: 'Eiben, A.E., Hinterding, R. & Michalewicz, Z.',
    year: '1999',
    title: 'Parameter control in evolutionary algorithms',
    source: 'IEEE Transactions on Evolutionary Computation, 3(2), 124–141',
    doi: '10.1109/4235.771166',
    category: 'Adaptive Mutation & Self-Adaptation',
  },
  {
    id: 18,
    authors: 'Karafotias, G., Hoogendoorn, M. & Eiben, A.E.',
    year: '2015',
    title: 'Parameter control in evolutionary algorithms: Trends and challenges',
    source: 'IEEE Transactions on Evolutionary Computation, 19(2), 167–187',
    doi: '10.1109/TEVC.2014.2308294',
    category: 'Adaptive Mutation & Self-Adaptation',
  },

  // ── Stress-Induced Mutagenesis (Biological Basis) ──
  {
    id: 19,
    authors: 'Radman, M.',
    year: '1975',
    title: 'SOS repair hypothesis: Phenomenology of an inducible DNA repair which is accompanied by mutagenesis',
    source: 'Basic Life Sciences, 5A, 355–367',
    doi: '10.1007/978-1-4684-2895-7_48',
    category: 'Stress-Induced Mutagenesis',
  },
  {
    id: 20,
    authors: 'Tenaillon, O., Taddei, F., Radman, M. & Matic, I.',
    year: '2004',
    title: 'Second-order selection in bacterial evolution: Selection acting on mutation and recombination rates in the course of adaptation',
    source: 'Research in Microbiology, 155(6), 457–463',
    doi: '10.1016/j.resmic.2004.01.013',
    category: 'Stress-Induced Mutagenesis',
  },

  // ── Statistics ──
  {
    id: 21,
    authors: 'Welch, B.L.',
    year: '1947',
    title: "The generalization of 'Student's' problem when several different population variances are involved",
    source: 'Biometrika, 34(1–2), 28–35',
    doi: '10.1093/biomet/34.1-2.28',
    category: 'Statistical Methods',
  },
  {
    id: 22,
    authors: 'Cohen, J.',
    year: '1988',
    title: 'Statistical Power Analysis for the Behavioral Sciences (2nd ed.)',
    source: 'Lawrence Erlbaum Associates',
    category: 'Statistical Methods',
  },
  {
    id: 23,
    authors: 'Hedges, L.V.',
    year: '1981',
    title: "Distribution theory for Glass's estimator of effect size and related estimators",
    source: 'Journal of Educational Statistics, 6(2), 107–128',
    doi: '10.3102/10769986006002107',
    category: 'Statistical Methods',
  },
  {
    id: 24,
    authors: 'Mann, H.B. & Whitney, D.R.',
    year: '1947',
    title: 'On a test of whether one of two random variables is stochastically larger than the other',
    source: 'Annals of Mathematical Statistics, 18(1), 50–60',
    doi: '10.1214/aoms/1177730491',
    category: 'Statistical Methods',
  },

  // ── Multi-Agent Systems & Reinforcement Learning ──
  {
    id: 25,
    authors: 'Shoham, Y. & Leyton-Brown, K.',
    year: '2009',
    title: 'Multiagent Systems: Algorithmic, Game-Theoretic, and Logical Foundations',
    source: 'Cambridge University Press',
    category: 'Multi-Agent Systems & Reinforcement Learning',
  },
  {
    id: 26,
    authors: 'Sutton, R.S. & Barto, A.G.',
    year: '2018',
    title: 'Reinforcement Learning: An Introduction (2nd ed.)',
    source: 'MIT Press',
    url: 'http://incompleteideas.net/book/the-book-2nd.html',
    category: 'Multi-Agent Systems & Reinforcement Learning',
  },

  // ── GPU Computing ──
  {
    id: 27,
    authors: 'Nickolls, J., Buck, I., Garland, M. & Skadron, K.',
    year: '2008',
    title: 'Scalable parallel programming with CUDA',
    source: 'ACM Queue, 6(2), 40–53',
    doi: '10.1145/1365490.1365500',
    category: 'GPU Computing',
  },

  // ── Information Theory ──
  {
    id: 28,
    authors: 'Shannon, C.E.',
    year: '1948',
    title: 'A mathematical theory of communication',
    source: 'Bell System Technical Journal, 27(3), 379–423',
    doi: '10.1002/j.1538-7305.1948.tb01338.x',
    category: 'Information Theory',
  },
]

// Group references by category for display
const categories = Array.from(new Set(references.map((r) => r.category)))

// Reusable citation superscript
export function Cite({ ids }: { ids: number[] }) {
  return (
    <sup className="text-indigo-500 dark:text-indigo-400 font-semibold cursor-default ml-0.5">
      [{ids.join(', ')}]
    </sup>
  )
}

export default function ReferencesSection() {
  return (
    <div className="sci-card p-6 md:p-8 animate-fade-in">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </span>
        References
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 pl-11">
        {references.length} sources across {categories.length} categories
      </p>

      <div className="space-y-8 pl-2 md:pl-4">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {category}
            </h3>
            <ol className="space-y-3">
              {references
                .filter((r) => r.category === category)
                .map((ref) => (
                  <li
                    key={ref.id}
                    id={`ref-${ref.id}`}
                    className="flex gap-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300 scroll-mt-24"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                      {ref.id}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {ref.authors}
                      </span>{' '}
                      ({ref.year}).{' '}
                      <em>{ref.title}</em>.{' '}
                      <span className="text-gray-500 dark:text-gray-400">
                        {ref.source}
                      </span>
                      {ref.doi && (
                        <>
                          {' '}
                          <a
                            href={`https://doi.org/${ref.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline decoration-dotted underline-offset-2"
                          >
                            doi:{ref.doi}
                          </a>
                        </>
                      )}
                      {!ref.doi && ref.url && (
                        <>
                          {' '}
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline decoration-dotted underline-offset-2"
                          >
                            [Link]
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
