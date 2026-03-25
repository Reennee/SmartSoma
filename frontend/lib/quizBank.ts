/**
 * Quiz question bank organised by subject → difficulty.
 * 4 questions are randomly drawn per session to assess comprehension.
 */

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correct: number; // 0-based index
}

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type Subject = "Mathematics" | "Physics" | string;

const bank: Record<string, Record<string, QuizQuestion[]>> = {
  Mathematics: {
    Beginner: [
      {
        id: "m-b-1",
        text: "Which of the following is the correct definition of a set?",
        options: [
          "A collection of well-defined, distinct objects",
          "A list of numbers in ascending order",
          "Any group of similar objects",
          "A collection of repeated elements",
        ],
        correct: 0,
      },
      {
        id: "m-b-2",
        text: "What is the LCM of 4 and 6?",
        options: ["8", "12", "24", "6"],
        correct: 1,
      },
      {
        id: "m-b-3",
        text: "Express 3/4 as a percentage.",
        options: ["34%", "43%", "75%", "80%"],
        correct: 2,
      },
      {
        id: "m-b-4",
        text: "A ratio of boys to girls in a class is 3:2. If there are 30 students, how many are girls?",
        options: ["10", "12", "15", "18"],
        correct: 1,
      },
      {
        id: "m-b-5",
        text: "Which number is a prime number?",
        options: ["9", "15", "17", "21"],
        correct: 2,
      },
      {
        id: "m-b-6",
        text: "What is the perimeter of a square with side 5 cm?",
        options: ["10 cm", "20 cm", "25 cm", "15 cm"],
        correct: 1,
      },
      {
        id: "m-b-7",
        text: "If A = {1, 2, 3} and B = {2, 3, 4}, what is A ∩ B?",
        options: ["{1, 2, 3, 4}", "{2, 3}", "{1, 4}", "{1, 2, 3}"],
        correct: 1,
      },
      {
        id: "m-b-8",
        text: "Which fraction is equivalent to 2/3?",
        options: ["4/9", "6/9", "3/4", "2/4"],
        correct: 1,
      },
    ],
    Intermediate: [
      {
        id: "m-i-1",
        text: "Solve for x: 3x + 7 = 22",
        options: ["x = 3", "x = 5", "x = 7", "x = 9"],
        correct: 1,
      },
      {
        id: "m-i-2",
        text: "What is the gradient of the line passing through (1, 2) and (3, 8)?",
        options: ["2", "3", "4", "6"],
        correct: 1,
      },
      {
        id: "m-i-3",
        text: "Find the area of a triangle with base 8 cm and height 5 cm.",
        options: ["20 cm²", "40 cm²", "13 cm²", "80 cm²"],
        correct: 0,
      },
      {
        id: "m-i-4",
        text: "Simplify: 2x² + 5x − x² + 3x",
        options: ["x² + 8x", "3x² + 8x", "x² − 8x", "3x² + 2x"],
        correct: 0,
      },
      {
        id: "m-i-5",
        text: "What is the value of x in the proportion 4/x = 8/14?",
        options: ["5", "6", "7", "8"],
        correct: 2,
      },
      {
        id: "m-i-6",
        text: "A rectangle has length (2x + 3) and width 4. Its perimeter is 38. Find x.",
        options: ["x = 3", "x = 4", "x = 5", "x = 6"],
        correct: 1,
      },
      {
        id: "m-i-7",
        text: "In a right triangle, if the two legs are 3 and 4, what is the hypotenuse?",
        options: ["5", "6", "7", "25"],
        correct: 0,
      },
      {
        id: "m-i-8",
        text: "What is 15% of 200?",
        options: ["20", "25", "30", "35"],
        correct: 2,
      },
    ],
    Advanced: [
      {
        id: "m-a-1",
        text: "Find the domain of f(x) = √(x − 3).",
        options: ["x ≤ 3", "x ≥ 3", "x > 3", "all real numbers"],
        correct: 1,
      },
      {
        id: "m-a-2",
        text: "What is log₂(32)?",
        options: ["4", "5", "6", "8"],
        correct: 1,
      },
      {
        id: "m-a-3",
        text: "Which measure of central tendency is most affected by extreme values?",
        options: ["Mode", "Median", "Mean", "Range"],
        correct: 2,
      },
      {
        id: "m-a-4",
        text: "Solve: 2^(x+1) = 16",
        options: ["x = 2", "x = 3", "x = 4", "x = 5"],
        correct: 1,
      },
      {
        id: "m-a-5",
        text: "If sin θ = 0.6, what is cos θ for 0° < θ < 90°?",
        options: ["0.4", "0.6", "0.8", "1.0"],
        correct: 2,
      },
      {
        id: "m-a-6",
        text: "The variance of a dataset is 16. What is the standard deviation?",
        options: ["2", "4", "8", "256"],
        correct: 1,
      },
      {
        id: "m-a-7",
        text: "What is the sum of the first 10 terms of an arithmetic series with a₁ = 2 and d = 3?",
        options: ["65", "155", "175", "185"],
        correct: 1,
      },
      {
        id: "m-a-8",
        text: "Which of the following represents an even function?",
        options: ["f(x) = x³", "f(x) = x² + 1", "f(x) = x + 1", "f(x) = sin x"],
        correct: 1,
      },
    ],
  },
  Physics: {
    Beginner: [
      {
        id: "p-b-1",
        text: "Which of the following is NOT a state of matter?",
        options: ["Solid", "Liquid", "Energy", "Gas"],
        correct: 2,
      },
      {
        id: "p-b-2",
        text: "What is the SI unit of force?",
        options: ["Joule", "Watt", "Newton", "Pascal"],
        correct: 2,
      },
      {
        id: "p-b-3",
        text: "A body moving at constant velocity has what net force acting on it?",
        options: ["10 N", "5 N", "Zero", "Depends on mass"],
        correct: 2,
      },
      {
        id: "p-b-4",
        text: "Which property of matter resists changes in motion?",
        options: ["Weight", "Inertia", "Density", "Volume"],
        correct: 1,
      },
      {
        id: "p-b-5",
        text: "Light travels fastest through which medium?",
        options: ["Water", "Glass", "Air", "Vacuum"],
        correct: 3,
      },
      {
        id: "p-b-6",
        text: "What instrument measures temperature?",
        options: ["Barometer", "Thermometer", "Hydrometer", "Manometer"],
        correct: 1,
      },
      {
        id: "p-b-7",
        text: "Which type of energy does a moving car possess?",
        options: ["Potential energy", "Kinetic energy", "Chemical energy", "Nuclear energy"],
        correct: 1,
      },
      {
        id: "p-b-8",
        text: "Density is defined as:",
        options: [
          "Volume per unit mass",
          "Mass per unit volume",
          "Force per unit area",
          "Energy per unit time",
        ],
        correct: 1,
      },
    ],
    Intermediate: [
      {
        id: "p-i-1",
        text: "An object is thrown upward with initial velocity 20 m/s. Using g = 10 m/s², what is the maximum height reached?",
        options: ["10 m", "15 m", "20 m", "40 m"],
        correct: 2,
      },
      {
        id: "p-i-2",
        text: "What is the work done when a force of 10 N moves an object 5 m in the direction of the force?",
        options: ["2 J", "15 J", "50 J", "500 J"],
        correct: 2,
      },
      {
        id: "p-i-3",
        text: "Ohm's Law states that V = IR. If R = 4 Ω and I = 3 A, what is V?",
        options: ["7 V", "12 V", "16 V", "1.3 V"],
        correct: 1,
      },
      {
        id: "p-i-4",
        text: "Two resistors of 6 Ω each are connected in parallel. What is the total resistance?",
        options: ["12 Ω", "6 Ω", "3 Ω", "1 Ω"],
        correct: 2,
      },
      {
        id: "p-i-5",
        text: "Which law states that energy cannot be created or destroyed?",
        options: [
          "Newton's First Law",
          "Ohm's Law",
          "Law of Conservation of Energy",
          "Hooke's Law",
        ],
        correct: 2,
      },
      {
        id: "p-i-6",
        text: "A wave has a frequency of 50 Hz and a wavelength of 2 m. What is its speed?",
        options: ["25 m/s", "52 m/s", "100 m/s", "0.04 m/s"],
        correct: 2,
      },
      {
        id: "p-i-7",
        text: "What happens to the pressure in a liquid as depth increases?",
        options: ["Decreases", "Stays the same", "Increases", "Becomes zero"],
        correct: 2,
      },
      {
        id: "p-i-8",
        text: "Which type of wave requires a medium to travel?",
        options: ["Light wave", "Radio wave", "X-ray", "Sound wave"],
        correct: 3,
      },
    ],
    Advanced: [
      {
        id: "p-a-1",
        text: "An electromagnetic wave has a frequency of 3 × 10⁸ Hz. What is its wavelength in a vacuum?",
        options: ["1 m", "10⁻⁸ m", "3 m", "10⁸ m"],
        correct: 0,
      },
      {
        id: "p-a-2",
        text: "Which of the following is emitted during alpha decay?",
        options: ["A proton", "An electron", "A helium nucleus", "A photon"],
        correct: 2,
      },
      {
        id: "p-a-3",
        text: "Faraday's law of electromagnetic induction relates induced EMF to:",
        options: [
          "Current in the circuit",
          "Rate of change of magnetic flux",
          "Resistance of the conductor",
          "Charge on the capacitor",
        ],
        correct: 1,
      },
      {
        id: "p-a-4",
        text: "In a transformer, if Np = 200 and Ns = 50, and Vp = 240 V, what is Vs?",
        options: ["60 V", "120 V", "480 V", "960 V"],
        correct: 0,
      },
      {
        id: "p-a-5",
        text: "The half-life of a radioactive isotope is 10 years. After 30 years, what fraction of the original sample remains?",
        options: ["1/2", "1/4", "1/8", "1/16"],
        correct: 2,
      },
      {
        id: "p-a-6",
        text: "Which phenomenon explains why the sky is blue?",
        options: [
          "Reflection of light",
          "Refraction of light",
          "Rayleigh scattering",
          "Diffraction of light",
        ],
        correct: 2,
      },
      {
        id: "p-a-7",
        text: "The critical angle in optics is defined when the angle of refraction is:",
        options: ["0°", "45°", "90°", "180°"],
        correct: 2,
      },
      {
        id: "p-a-8",
        text: "According to Einstein, what happens to the mass of an object as its velocity approaches the speed of light?",
        options: ["Decreases", "Stays constant", "Increases", "Becomes zero"],
        correct: 2,
      },
    ],
  },
};

/** Pick `count` random questions for the given subject + difficulty. Falls back gracefully. */
export function getQuizQuestions(
  subject: Subject,
  difficulty: Difficulty | string,
  count = 4
): QuizQuestion[] {
  const subjectBank = bank[subject] ?? bank["Mathematics"];
  const diffBank = subjectBank[difficulty] ?? subjectBank["Beginner"] ?? [];

  // Fallback: merge all difficulties if not enough questions
  let pool = [...diffBank];
  if (pool.length < count) {
    const all = Object.values(subjectBank).flat();
    pool = all;
  }

  // Fisher-Yates shuffle, take first `count`
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
