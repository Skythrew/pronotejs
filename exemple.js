require('dotenv').config();
const pronotepy = require('./pronotepy');
const { Client } = pronotepy
const { DateTime } = require('luxon');

// Initialise the client
// Note: the address should be a direct one (like the one below). Usually, the address shown by your school just redirects you to the real one.
// Ex.: https://your-school.com/pronote/students <-- BAD
//      https://0000000a.index-education.net/pronote/eleve.html <-- GOOD
//      https://0000000a.index-education.net/pronote/eleve.html?login=true <-- ONLY IF YOU HAVE AN ENT AND YOU KNOW YOUR IDS, ELSE REFER TO ENT PART OF README

const client = new Client({pronote_url:process.env.PRONOTE_URL,
  username: process.env.PRONOTE_USERNAME,
  password: process.env.PRONOTE_PASSWORD,
});

(async () => {
  try {
   
    if (client.logged_in) {
      const nom_utilisateur = client.info.name; // Get user's name
      console.log(`Logged in as ${nom_utilisateur}`);
      
      const periods = await client.getPeriods(); // Get all the periods

      for (const period of periods) {
        for (const grade of period.grades) { // Iterate over all the grades
          console.log(`${grade.grade}/${grade.out_of}`); // Print out the grade in this style: 20/20
        }
      }

      const today = DateTime.now(); // Store today's date using the Luxon library
      const homework = await client.getHomework(today); // Get a list of homework for today and later
      
      for (const hw of homework) { // Iterate through the list
        console.log(`(${hw.subject.name}): ${hw.description}`); // Print the homework's subject, title, and description
      }
    } else {
      console.log("Failed to log in");
    }
  } catch (error) {
    console.error(error);
  } finally {
  }
})();
