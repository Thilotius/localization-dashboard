// Maps Lokalise team tags to the projects that belong to them.
// A project can appear in multiple groups (e.g. shared/platform projects).
// Projects not listed in any group are shown under an automatic "Unassigned" catch-all.

export const PRODUCT_GROUPS = [
  {
    key: 'bma',
    label: 'BMA',
    projectNames: [
      'BioAge - Shared',
      'BMA Analysis',
      'BMA App Configurator (NEW)',
      'BMA Automated Emails',
      'BMA Email Templates',
      'BMA Backend',
      'BMA Backend Activity Feed',
      'BMA Backend Pulsar',
      'BMA Club Portal',
      'BMA Club Portal - Common Titles',
      'BMA Club Portal Notifications',
      'BMA Club Portal Reporting',
      'BMA Mobile',
      'BMA MWA MyAccount',
      'BMA: App Configurator Previewer',
      'EGYM Genius',
      'EgymLink',
      'Mirror Opt-in - Shared',
      'MWA Apps',
    ],
  },
  {
    key: 'core-workouts',
    label: 'Core Workouts',
    projectNames: [
      'Activity Library',
      'AL-development-cat',
      'AL-development-staging',
      'Business Suite (old)',
      'Mirror Opt-in - Shared',
    ],
  },
  {
    key: 'fitness-hub',
    label: 'Fitness Hub',
    projectNames: [
      'BioAge - Shared',
      'EGYM Genius',
      'Fitness Hub GUI',
      'Mirror Opt-in - Shared',
    ],
  },
  {
    key: 'operator-experience',
    label: 'Operator Experience',
    projectNames: [
      'Business Suite (new)',
      'EGYM Genius',
    ],
  },
  {
    key: 'smart-cardio',
    label: 'Smart Cardio',
    projectNames: [
      'EGYM Genius',
      'Mirror Opt-in - Shared',
      'Smart Cardio',
    ],
  },
  {
    key: 'smart-strength',
    label: 'Smart Strength',
    projectNames: [
      'EGYM Genius',
      'Machine Software GUI',
      'Mirror Opt-in - Shared',
    ],
  },
  {
    key: 'trainer-app',
    label: 'Trainer App',
    projectNames: [
      'BioAge - Shared',
      'EGYM Genius',
      'EGYM Trainer App',
      'Mirror Opt-in - Shared',
      'pdf-service',
      'Trainer-Calendar',
    ],
  },
  {
    key: 'wellpass',
    label: 'Wellpass',
    projectNames: [
      'BMA Mobile',
      'Wellpass App (BMA Mobile Adaptation)',
      'Wellpass App (Configuration)',
      'Wellpass Checkin MWA',
      'Wellpass Class Booking backend',
      'Wellpass Class Booking MWA',
      'Wellpass Gym Finder Frontend',
      'Wellpass Membership Management MWA',
      'Wellpass Signup Pages & Web Login',
    ],
  },
  {
    key: 'xt',
    label: 'XT',
    projectNames: [
      'BioAge - Shared',
      'EGYM Genius',
      'Workout Prediction',
    ],
  },
  {
    key: 'localization',
    label: 'Localization',
    projectNames: [
      'Design Test Project',
      'EGYM Glossary',
      'Figma Demo',
      'One Echo Beta Test',
      'Test',
      'Test Project Design System',
      'Test Project Design System 2',
    ],
  },
]
