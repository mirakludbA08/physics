/* IALqBank — topic taxonomy.
   Groups each question into a broad topic with a few subtopics, so the filter
   panel can show a short list that expands on click. Each subject lists its
   rules in priority order: the first rule whose pattern matches a question's
   topic, keywords or paper title decides its broad topic and subtopic. Anything
   that matches nothing falls into "Other". */
window.TAXONOMY = window.TAXONOMY || {};

window.TAXONOMY.physics = [
  { broad: 'Motion', subs: [
    { name: 'Projectiles', rx: /projectile|projected|launched|angle of projection|trajector|range of|horizontal(ly)? (launch|project|fired)|thrown/i },
    { name: 'Graphs of motion', rx: /graph|gradient|area under|sketch|s-t|v-t|a-t|suvat graph/i },
    { name: 'SUVAT and free fall', rx: /suvat|free.?fall|falls? (from|through)|uniform(ly)? accelerat|deceler|braking|stopping|dropped|equation of motion|velocity|displacement|speed/i },
    { name: 'Vectors and relative motion', rx: /vector|resultant|component|relative|bearing|direction/i }
  ] },
  { broad: 'Forces and momentum', subs: [
    { name: 'Newton and free-body', rx: /newton|free.?body|force diagram|resultant force|f\s?=\s?ma|weight|tension|normal reaction/i },
    { name: 'Friction and inclines', rx: /friction|incline|slope|ramp|coefficient/i },
    { name: 'Momentum and impulse', rx: /momentum|impulse|collision|collide|elastic|inelastic|recoil|explosion|rebound/i },
    { name: 'Equilibrium and moments', rx: /moment|equilibrium|centre of (gravity|mass)|pivot|lever|balanced/i }
  ] },
  { broad: 'Energy and power', subs: [
    { name: 'Work and energy', rx: /work done|kinetic energy|potential energy|energy transfer|energy stored|energy conservation|conserv/i },
    { name: 'Power and efficiency', rx: /power|efficien|watt/i },
    { name: 'Heating and thermal energy', rx: /heat|temperature|specific heat|latent|thermal|ideal gas|kinetic theory|gas|pressure|internal energy|thermodynamic/i }
  ] },
  { broad: 'Materials and fluids', subs: [
    { name: 'Density and upthrust', rx: /density|upthrust|archimedes|buoyan|float|sink/i },
    { name: 'Viscosity and drag', rx: /viscos|drag|terminal velocity|stokes/i },
    { name: 'Stress, strain and Hooke', rx: /hooke|stress|strain|young|elastic|spring|stiffness|extension|breaking/i }
  ] },
  { broad: 'Waves and light', subs: [
    { name: 'Wave properties', rx: /wave|frequency|wavelength|amplitude|transverse|longitudinal|v\s?=\s?f|pulse|echo/i },
    { name: 'Superposition and standing waves', rx: /superposition|interference|standing|stationary|node|antinode|path difference|phase/i },
    { name: 'Refraction, diffraction and polarisation', rx: /refract|snell|refractive|critical angle|total internal|diffract|grating|polaris|lens|reflect/i },
    { name: 'Photons and quantum light', rx: /photon|photoelectric|work function|de broglie|quantum|energy level|emission|absorption|electron volt|wave-particle/i }
  ] },
  { broad: 'Electricity', subs: [
    { name: 'Current and resistance', rx: /current|resistance|resistivity|i-v|ohm|drift velocity|carrier|conductor/i },
    { name: 'Circuits and EMF', rx: /circuit|series|parallel|emf|e\.m\.f|internal resistance|potential divider|voltmeter|ammeter|lamp|cell/i },
    { name: 'Capacitors', rx: /capacitor|capacitance|charge|discharg|rc |time constant|stored energy/i },
    { name: 'Magnetism and induction', rx: /magnetic|magnet|induct|faraday|lenz|solenoid|flux|motor effect|force on a wire|coil/i }
  ] },
  { broad: 'Fields', subs: [
    { name: 'Electric fields', rx: /electric field|coulomb|point charge|potential difference|field strength|electric potential|equipotential/i },
    { name: 'Gravitational fields', rx: /gravitational|orbit|satellite|escape|geostationary|kepler|gravity/i }
  ] },
  { broad: 'Oscillations and circular motion', subs: [
    { name: 'Circular motion', rx: /circular|centripetal|radian|angular|orbit of|banked|radius of (the )?circle/i },
    { name: 'Simple harmonic motion', rx: /oscillat|harmonic|shm|pendulum|resonan|damp|period|mass-spring|spring constant/i }
  ] },
  { broad: 'Nuclear and particle physics', subs: [
    { name: 'Radioactive decay', rx: /decay|half-life|half life|activity|alpha|beta|gamma|radioactiv|isotope|nucle|binding energy|mass defect|becquerel/i },
    { name: 'Particles and accelerators', rx: /particle|quark|lepton|meson|baryon|hadron|accelerat(or|ing) (region|particle)|cyclotron|synchrotron|collider|detector|antiparticle|annihilat|pion|muon|neutrino|strange|charm|pair produc/i },
    { name: 'Scattering and atomic models', rx: /scatter|rutherford|atomic model|electron energy|hydrogen|spectrum|spectral line/i }
  ] },
  { broad: 'Space and cosmology', subs: [
    { name: 'Stars and astrophysics', rx: /star|hertzsprung|hr diagram|luminosity|parallax|magnitude|brightness|galax|nebula/i },
    { name: 'Cosmology and expansion', rx: /cosmolog|universe|hubble|redshift|expansion|big bang|cmb|microwave background/i }
  ] },
  { broad: 'Practical skills', subs: [
    { name: 'Uncertainties and measurement', rx: /uncertaint|percentage error|precision|accuracy|anomal|measur|reading|significant figure|systematic|random error/i },
    { name: 'Graphs and data analysis', rx: /log|linear|plot|best.?fit|data|gradient of the graph|intercept/i }
  ] }
];

window.TAXONOMY.chemistry = [
  { broad: 'Atoms, moles and bonding', subs: [
    { name: 'Formulae and moles', rx: /formula|bmoles?b|molar|empirical|molecular formula|stoichiometr|percentage yield|atom economy|reacting mass|limiting reagent/i },
    { name: 'Atomic structure', rx: /atomic structure|electron configuration|isotope|mass spectr|relative atomic|orbital|shell|subshell|ionisation/i },
    { name: 'Chemical bonding and shapes', rx: /bond|ionic|covalent|metallic|shape of|vsepr|electronegativ|polar|dipole|lattice|hybridis|sigma|pi bond/i },
    { name: 'Periodic trends', rx: /period 3|periodic|group|trend|atomic radius|melting point/i }
  ] },
  { broad: 'Energetics', subs: [
    { name: 'Enthalpy and Hess cycles', rx: /enthalpy|hess|standard enthalpy|combustion|formation|neutralisation enthalpy|calorimetry|delta h|δh/i },
    { name: 'Bond enthalpy', rx: /bond enthalpy|bond energy|bond dissociation/i },
    { name: 'Lattice energy and Born-Haber', rx: /lattice|born.?haber|hydration enthalpy/i },
    { name: 'Entropy and free energy', rx: /entropy|free energy|gibbs|feasib|spontaneous/i }
  ] },
  { broad: 'Kinetics and equilibrium', subs: [
    { name: 'Rate of reaction', rx: /rate|kinetic|order of reaction|rate constant|half.?life|catalyst|activation energy|arrhenius|rate equation/i },
    { name: 'Equilibrium constants', rx: /equilibri|kc|kp|le chatelier|dynamic equilibrium|equilibrium constant|partial pressure/i },
    { name: 'Acids, bases and pH', rx: /acid|base|ph |ph\b|pka|ka\b|kb\b|buffer|neutralis|indicator|hydrolysis|dissociation constant/i },
    { name: 'Solubility', rx: /solubility|ksp|precipitat|saturated/i }
  ] },
  { broad: 'Redox and electrochemistry', subs: [
    { name: 'Redox reactions', rx: /redox|oxidation state|oxidation number|oxidised|reduced|oxidising|reducing|disproportion/i },
    { name: 'Electrode potentials and cells', rx: /electrode|e-cell|standard electrode|cell potential|galvanic|salt bridge|half.?equation|electrochemical/i },
    { name: 'Fuel cells and electrolysis', rx: /fuel cell|electrolysis|electrolyte|faraday|anode|cathode/i }
  ] },
  { broad: 'Organic chemistry', subs: [
    { name: 'Alkanes and alkenes', rx: /alkane|alkene|addition|polymer|cracking|free radical|halogenation|ethene|propene|bromine water/i },
    { name: 'Halogenoalkanes and alcohols', rx: /halogenoalkane|haloalkane|alcohol|ethanol|propan|oxidation of alcohol|elimination|sn1|sn2|nucleophilic substitution|primary|secondary|tertiary/i },
    { name: 'Carbonyls and acids', rx: /carbonyl|aldehyde|ketone|carboxylic|acyl|ester|esterif|tollens|fehling|2,4-dnph|iodoform/i },
    { name: 'Arenes and aromatics', rx: /benzene|arene|aromatic|phenol|nitration|friedel|electrophilic substitution/i },
    { name: 'Nitrogen compounds', rx: /amine|amide|nitrile|amino acid|nitro|diazonium|peptide|protein/i },
    { name: 'Organic synthesis and mechanisms', rx: /synthesis|mechanism|reagent|route|retrosynth|chirality|chiral|isomer|stereo|enantiomer|functional group/i },
    { name: 'Spectroscopy and analysis', rx: /nmr|ir spectr|infrared|mass spectrum|spectroscop|chromatograph|fragment|peak|tlc/i }
  ] },
  { broad: 'Group chemistry', subs: [
    { name: 'Group 1 and 2', rx: /group 1|group 2|alkali metal|alkaline earth|flame test|hydroxide|carbonate|thermal stability|lithium|sodium|potassium|magnesium|calcium/i },
    { name: 'Group 7 (halogens)', rx: /group 7|halogen|chlorine|bromine|iodine|halide|silver nitrate|disproportionation of chlorine/i },
    { name: 'Transition metals', rx: /transition metal|complex ion|ligand|coordination|d-block|colour of (ion|complex)|catalyst.*metal|vanadium|chromium|manganese|iron|copper|cobalt|nickel/i }
  ] },
  { broad: 'Practical and analysis', subs: [
    { name: 'Titrations', rx: /titrat|burette|pipette|end.?point|indicator/i },
    { name: 'Practical technique and errors', rx: /practical|experiment|apparatus|accuracy|uncertainty|error|measur|precision|reading|hazard|safety/i }
  ] }
];

window.TAXONOMY.biology = [
  { broad: 'Cells and molecules', subs: [
    { name: 'Cell structure and organelles', rx: /organelle|cell structure|mitochondri|nucleus|ribosome|golgi|endoplasmic|lysosome|chloroplast|cell wall|microscop|magnification|cell size/i },
    { name: 'Membranes and transport', rx: /membrane|diffusion|osmosis|active transport|facilitated|water potential|cotransport|channel protein|transport across/i },
    { name: 'Enzymes', rx: /enzyme|active site|substrate|inhibitor|catalys|optimum|denatur|lock and key/i },
    { name: 'Biological molecules and DNA', rx: /protein|amino acid|dna|rna|nucleotide|carbohydrate|lipid|starch|glycogen|cellulose|polysaccharide|hydrogen bond|base pair|peptide|polymer/i }
  ] },
  { broad: 'Genetics and inheritance', subs: [
    { name: 'Inheritance and alleles', rx: /allele|inherit|genotype|phenotype|dominant|recessive|punnett|monohybrid|dihybrid|chi.?square|pedigree|sex.?linked|codominan|linkage/i },
    { name: 'Mutation and variation', rx: /mutation|mutant|variation|meiosis|crossing over|gene pool|natural selection|evolution|hardy.?weinberg|allele frequency/i },
    { name: 'Gene expression and control', rx: /transcription|translation|mrna|trna|promoter|gene expression|operon|epigen|codon|anticodon|regulat/i },
    { name: 'Gene technology', rx: /gene technolog|pcr|plasmid|restriction|vector|recombinant|gene therap|crispr|cloning|gel electrophoresis|genetic engineer|transgenic|gm /i }
  ] },
  { broad: 'Cell division and development', subs: [
    { name: 'Mitosis and cell cycle', rx: /mitosis|cell cycle|interphase|cytokinesis|chromosome|centromere|spindle/i },
    { name: 'Development and stem cells', rx: /development|embryo|stem cell|differentiat|totipoten|pluripot|fertilis|fertiliz|sperm|egg|gamete|ovum|zygote|placenta/i }
  ] },
  { broad: 'Respiration and photosynthesis', subs: [
    { name: 'Photosynthesis', rx: /photosynth|chloroplast|light.?dependent|calvin|rubisco|chlorophyll|thylakoid|light intensity|carbon fixation|limiting factor|rubp|action spectrum/i },
    { name: 'Respiration', rx: /respirat|krebs|glycolysis|atp|mitochondrial matrix|anaerobic|aerobic|electron transport|ethanol fermentation|lactate/i }
  ] },
  { broad: 'Human physiology', subs: [
    { name: 'Circulation and heart', rx: /heart|cardiac|blood vessel|artery|arteries|vein|capillar|aorta|blood pressure|ecg|cardiovascular|pulse|valve|atherosclero|cholesterol|circulat/i },
    { name: 'Nervous system and coordination', rx: /neuron|neurone|nerve|synap|action potential|reflex|brain|cerebr|receptor|myelin|sodium channel|resting potential|eye|retina|rhodopsin|coordinat/i },
    { name: 'Hormones and homeostasis', rx: /hormone|insulin|glucagon|adrenaline|thyroid|adh|vasopressin|homeostasis|negative feedback|blood glucose|kidney|nephron|osmoregulat|urea|ultrafiltration|diabetes|thermoregul/i },
    { name: 'Muscles and movement', rx: /muscle|sarcomere|myosin|actin|sliding filament|contraction|tendon|skeleton|joint|bone|ligament|acl/i },
    { name: 'Digestion and immunity', rx: /digest|amylase|gut|intestin|stomach|liver|pancrea|immun|antibod|antigen|lymph|t cell|b cell|phagocyt|vaccin|inflamm|allerg|hiv|pathogen|microb|bacteri|virus|infect/i }
  ] },
  { broad: 'Plants', subs: [
    { name: 'Plant structure and transport', rx: /xylem|phloem|transpirat|stomata|stoma|root hair|leaf structure|plant tissue|translocation|guard cell|cuticle/i },
    { name: 'Plant growth and hormones', rx: /plant hormone|auxin|gibberellin|tropism|geotropism|phototropism|germinat/i }
  ] },
  { broad: 'Ecology and environment', subs: [
    { name: 'Populations and sampling', rx: /population|quadrat|transect|sampling|capture.?recapture|mark.?release|abundance|lincoln|simpson|diversity index|species richness|biodiversity/i },
    { name: 'Food chains and energy flow', rx: /food chain|food web|trophic|energy flow|pyramid|productivity|nutrient cycl|nitrogen cycle|carbon cycle|water cycle|decomposer|saprotroph/i },
    { name: 'Climate and conservation', rx: /climate|global warming|greenhouse|carbon dioxide|co2|conservation|extinction|deforest|pollution|eutroph|endangered/i },
    { name: 'Classification and evolution', rx: /classification|taxon|kingdom|domain|binomial|phylogen|species|dichotomous|cladistic|speciation/i }
  ] },
  { broad: 'Microbiology and disease', subs: [
    { name: 'Microbes and pathogens', rx: /bacteria|virus|fungus|fungal|protoctist|prokaryote|capsule|antibiotic|resistance|plasmid|microorganism|culture|incubation|aseptic/i },
    { name: 'Decomposition and forensics', rx: /decompos|forensic|corpse|rigor|post.?mortem|ph of decay|decay of/i }
  ] },
  { broad: 'Practical skills', subs: [
    { name: 'Data and statistics', rx: /statistic|chi|mean|standard deviation|t.test|correlation|significance|error bar|percentage|ratio|calculate|mean/i },
    { name: 'Practicals and measurement', rx: /practical|experiment|measur|accuracy|precision|uncertainty|magnification|microscop|scale|dilution|serial/i }
  ] }
];

window.TAXONOMY.maths = [
  { broad: 'Algebra', subs: [
    { name: 'Indices, surds and logs', rx: /indices|index|surd|rationali|log|logarithm|exponential law|e\^/i },
    { name: 'Polynomials and factors', rx: /factor|remainder|polynomial|division|algebraic division|quadratic|discriminant|completing the square|roots of|sum of roots/i },
    { name: 'Inequalities and proof', rx: /inequalit|prove|proof|show that|am.?gm|counterexample|contradiction|disprove|induction/i },
    { name: 'Sequences and series', rx: /sequence|series|arithmetic|geometric|common ratio|common difference|recursive|recurrence|sigma|sum to|convergent/i },
    { name: 'Binomial expansion', rx: /binomial|expansion|pascal|coefficient of x/i }
  ] },
  { broad: 'Coordinate geometry', subs: [
    { name: 'Straight lines', rx: /straight line|gradient of (a |the )?line|perpendicular|parallel|midpoint|y = mx|intercept|line segment|collinear/i },
    { name: 'Circles', rx: /circle|centre|radius|tangent to|chord|diameter|circumference/i },
    { name: 'Parametric equations', rx: /parametric|parameter|cartesian from/i },
    { name: 'Coordinates and areas', rx: /triangle|quadrilateral|parallelogram|area of a region|coordinates/i }
  ] },
  { broad: 'Trigonometry', subs: [
    { name: 'Trig identities and equations', rx: /identit|solve.*sin|solve.*cos|solve.*tan|trig equation|sin\s?2|cos\s?2|double angle|tan\s?\(|exact value/i },
    { name: 'Sine and cosine rules', rx: /sine rule|cosine rule|bearing|triangle.*angle|area of triangle|arc|sector|radians|segment/i },
    { name: 'Trig graphs', rx: /trig(onometric)? graph|sin graph|period|amplitude|sketch.*sin|sketch.*cos/i }
  ] },
  { broad: 'Functions and graphs', subs: [
    { name: 'Modulus and transformations', rx: /modulus|\|x|transform|translation|stretch|reflection|asymptote of reciprocal/i },
    { name: 'Rational functions', rx: /rational|partial fraction|reciprocal|asymptote/i },
    { name: 'Exponential and log graphs', rx: /exponential|e\^x|e\^\(|growth|decay|model|logistic/i },
    { name: 'Composite and inverse functions', rx: /composite|inverse function|domain|range of|fg\(|gf\(/i }
  ] },
  { broad: 'Calculus', subs: [
    { name: 'Differentiation', rx: /differentiat|derivative|dy\/dx|gradient of the curve|tangent|normal|stationary|turning point|chain rule|product rule|quotient rule|implicit|second derivative|increasing|decreasing/i },
    { name: 'Integration', rx: /integrat|integral|antiderivative|substitution|by parts|definite|trapezium|simpson|volume of revolution|rotation/i },
    { name: 'Areas under curves', rx: /area under|area between|area of a region|area bounded|enclosed by|between (the )?curves?|under the curve/i },
    { name: 'Differential equations', rx: /differential equation|separable|integrating factor|dy\/dt|dy\/dx =/i },
    { name: 'Numerical methods', rx: /numerical|iteration|newton.?raphson|fixed point|change of sign|trapezium rule|estimate/i }
  ] },
  { broad: 'Vectors', subs: [
    { name: 'Vector basics', rx: /vector|position vector|unit vector|magnitude|component|resultant/i },
    { name: 'Scalar product and angles', rx: /scalar product|dot product|angle between/i },
    { name: 'Lines in 3D', rx: /vector equation|line.*vector|3d|plane|intersect/i }
  ] },
  { broad: 'Mechanics: forces', subs: [
    { name: 'Forces and equilibrium', rx: /equilibrium|resultant force|force|tension|weight|normal reaction|horizontal and vertical/i },
    { name: 'Friction and inclines', rx: /friction|incline|slope|ramp|coefficient of|rough/i },
    { name: 'Pulleys and connected bodies', rx: /pulley|string|connected|rope|tension in/i },
    { name: 'Moments', rx: /moment|pivot|lever|centre of mass|uniform rod|beam|hinge/i }
  ] },
  { broad: 'Mechanics: motion', subs: [
    { name: 'SUVAT', rx: /suvat|acceleration|deceleration|velocity|displacement|speed|uniform|fall|dropped|thrown|brake|stop/i },
    { name: 'Graphs of motion', rx: /graph|sketch|velocity-time|velocity time|displacement-time|speed-time/i },
    { name: 'Momentum and impulse', rx: /momentum|impulse|collision|collide|elastic|rebound|coalesc|direct impact|ball/i }
  ] },
  { broad: 'Probability and statistics', subs: [
    { name: 'Random variables', rx: /random variable|probability|distribution|binomial distribution|poisson/i },
    { name: 'Hypothesis and data', rx: /hypothesis|significance|correlation|regression|mean|variance/i }
  ] }
];

/* Broad topics are checked in the order listed here, so specific groups claim
   their questions before generic ones do. Each subject's rules keep their own
   order within a broad topic. */
function prioritise(subject, order) {
  const byName = {};
  subject.forEach(b => { byName[b.broad] = b; });
  return order.map(name => byName[name]).concat(subject.filter(b => order.indexOf(b.broad) === -1));
}
window.TAXONOMY.chemistry = prioritise(window.TAXONOMY.chemistry, [
  'Energetics', 'Kinetics and equilibrium', 'Redox and electrochemistry', 'Organic chemistry',
  'Group chemistry', 'Practical and analysis', 'Atoms, moles and bonding'
]);
window.TAXONOMY.maths = prioritise(window.TAXONOMY.maths, [
  'Calculus', 'Mechanics: motion', 'Mechanics: forces', 'Vectors', 'Trigonometry',
  'Functions and graphs', 'Coordinate geometry', 'Algebra', 'Probability and statistics'
]);
