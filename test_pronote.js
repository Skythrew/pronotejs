const pronotepy = require('pronotepy');
const datetime = require('datetime');
const unittest = require('unittest');

const client = new pronotepy.Client(
    "https://demo.index-education.net/pronote/eleve.html", "demonstration", "pronotevs"
);

const parent_client = new pronotepy.ParentClient(
    "https://demo.index-education.net/pronote/parent.html",
    { username: "demonstration", password: "pronotevs" }
);

class TestClient extends unittest.TestCase {
    constructor() {
        super();
        this.client = client;
        this.parent_client = parent_client;
    }

    test__get_week() {
        this.assertEqual(
            client.get_week(client.start_day + datetime.timedelta(days=8)), 2
        );
    }

    test_lessons() {
        const start = client.start_day;
        const end = client.start_day + datetime.timedelta(days=8);
        const lessons = client.lessons(start, end);
        // We assume demo website will always have some lessons
        this.assertGreater(lessons.length, 0);
        for (const lesson of lessons) {
            this.assertLessEqual(start, lesson.start.date());
            this.assertLessEqual(lesson.start.date(), end);
        }
    }

    test_periods() {
        this.assertIsNotNone(client.periods);
    }

    test_current_period() {
        const p = client.current_period;
        this.assertIsNotNone(p);
        const pronote_time = pronotepy.Util.datetime_parse(
            client.func_options["donneesSec"]["donnees"]["DateServeurHttp"]["V"]
        );
        this.assertTrue(
            p.start < pronote_time < p.end,
            "current_period is not in progress"
        );
    }

    test_homework() {
        const start = client.start_day;
        const end = client.start_day + datetime.timedelta(days=31);
        const homework = client.homework(start, end);

        // We assume demo website will always have homework
        this.assertGreater(homework.length, 0);
        for (const hw of homework) {
            this.assertLessEqual(start, hw.date);
            this.assertLessEqual(hw.date, end);
        }
    }

    test_recipients() {
        const recipients = client.get_recipients();

        // We assume demo website will always have discussions
        this.assertGreater(recipients.length, 0);
    }

    test_menus() {
        const start = client.start_day;
        const end = client.start_day + datetime.timedelta(days=8);
        const menus = client.menus(start, end);
        for (const menu of menus) {
            this.assertLessEqual(start, menu.date);
            this.assertLessEqual(menu.date, end);
        }
    }

    test_export_ical() {
        const requests = require('requests');

        const ical = client.export_ical();
        const resp = requests.get(ical);
        this.assertEqual(resp.status_code, 200);
    }

    test_refresh() {
        client.refresh();
        this.assertEqual(client.session_check(), true);
    }
}

class TestPeriod extends unittest.TestCase {
    static period;

    static setUpClass() {
        this.period = client.current_period;
    }

    test_grades() {
        // We assume demo website will have grades
        const grades = this.period.grades;
        this.assertGreater(grades.length, 0);
    }

    test_averages() {
        this.assertGreater(this.period.averages.length, 0);
    }

    test_overall_average() {
        this.assertIsNotNone(this.period.overall_average);
    }

    test_evaluations() {
        const evaluations = this.period.evaluations;
        this.assertGreater(evaluations.length, 0);
        for (const evaluation of evaluations) {
            for (const acquisition of evaluation.acquisitions) {
                this.assertIsNotNone(acquisition);
            }
        }
    }

    test_absences() {
        const all_absences = [];
        for (const period of client.periods) {
            all_absences.push(...period.absences);
        }
        this.assertGreater(all_absences.length, 0);
    }

    test_delays() {
        const all_delays = [];
        for (const period of client.periods) {
            all_delays.push(...period.delays);
        }
        this.assertGreater(all_delays.length, 0);
    }

    test_punishments() {
        const all_punishments = [];
        for (const period of client.periods) {
            all_punishments.push(...period.punishments);
        }
        this.assertGreater(all_punishments.length, 0, "there are no punishments");
    }

    test_class_overall_average() {
        const a = this.period.class_overall_average;
        this.assertTrue(typeof a === 'string' || a === null);
    }

    test_report() {
        const report = this.period.report;
        this.assertTrue(report === null || report instanceof pronotepy.Report);
    }
}

class TestInformation extends unittest.TestCase {
  test_unread() {
    const information = client.information_and_surveys({ only_unread: true });
    for (const info of information) {
      this.assertFalse(info.read);
    }
  }

  test_time_delta() {
    const start = new Date(
      client.start_day.getFullYear(),
      client.start_day.getMonth(),
      client.start_day.getDate()
    );
    const end = new Date(start.getTime() + 100 * 24 * 60 * 60 * 1000);
    const information = client.information_and_surveys({
      date_from: start,
      date_to: end,
    });
    for (const info of information) {
      this.assertTrue(
        info.start_date !== null &&
          start <= info.start_date &&
          info.start_date <= end,
        "date outside the research limits"
      );
    }
  }
}

class TestLesson extends unittest.TestCase {
  static lesson;

  static setUpClass() {
    global.client;
    this.lesson = client.lessons(
      new Date(client.start_day.getTime() + 4 * 24 * 60 * 60 * 1000)
    )[0];
  }

  test_normal() {
    this.assertIsNotNone(this.lesson.normal);
  }

  test_content() {
    this.assertIsInstance(
      this.lesson.content,
      pronotepy.LessonContent
    );
  }
}

class TestLessonContent extends unittest.TestCase {
  static lessonContent;

  static setUpClass() {
    global.client;
    const content = client.lessons(
      new Date(client.start_day.getTime() + 4 * 24 * 60 * 60 * 1000)
    )[0].content;
    if (content === null) {
      throw new Error("Content is None!");
    }
    this.lessonContent = content;
  }

  test_files() {
    this.assertIsNotNone(this.lessonContent.files);
  }
}

class TestDiscussion extends unittest.TestCase {
  static discussion;

  static setUpClass() {
    global.parent_client;
    this.discussion = parent_client.discussions()[0];
  }

  test_messages() {
    this.assertNotEqual(
      this.discussion.messages.length,
      0,
      "Discussion has no message"
    );
  }

  test_mark_read() {
    this.discussion.mark_as(true);
  }

  test_reply() {
    for (const discussion of parent_client.discussions()) {
      if (discussion.closed) {
        this.assertRaises(DiscussionClosed, () => {
          discussion.reply("test");
        });
      } else {
        discussion.reply("test");
      }
    }
  }

  test_delete() {
    this.discussion.delete();
  }

  test_participants() {
    this.assertGreater(
      this.discussion.participants().length,
      0,
      "discussion has no participants"
    );
  }
}

class TestMenu extends unittest.TestCase {
  static menu;

  static setUpClass() {
    global.client;
    let i = 0;
    let menus = client.menus(
      new Date(client.start_day.getTime() + i * 24 * 60 * 60 * 1000)
    );
    while (menus.length === 0) {
      i += 1;
      menus = client.menus(
        new Date(client.start_day.getTime() + i * 24 * 60 * 60 * 1000)
      );
    }
    this.menu = menus[0];
  }

  test_lunch_dinner() {
    this.assertNotEqual(
      this.menu.is_lunch,
      this.menu.is_dinner,
      "The menu is neither a lunch nor a dinner or is both"
    );
  }
}

class TestParentClient extends unittest.TestCase {
  static client = parent_client;

  test_set_child() {
    this.client.set_child(this.client.children[1]);
    this.client.set_child("PARENT Fanny");
  }

  test_homework() {
    this.assertIsNotNone(
      this.client.homework(
        this.client.start_day,
        new Date(
          this.client.start_day.getTime() + 31 * 24 * 60 * 60 * 1000
        )
      )
    );
  }

  test_discussion() {
    const discussions = this.client.discussions();

    // We assume demo website will always have discussions
    this.assertGreater(discussions.length, 0);
  }
}

class TestVieScolaireClient extends unittest.TestCase {
  static client;

  static setUpClass() {
    this.client = new pronotepy.VieScolaireClient(
      "https://demo.index-education.net/pronote/viescolaire.html",
      "demonstration2",
      "pronotevs"
    );
  }

  test_classes() {
    this.assertGreater(this.client.classes.length, 0);

    for (const cls of this.client.classes) {
      this.assertIsNotNone(cls.name);
    }

    for (const student of this.client.classes[0].students()) {
      this.assertIsInstance(student.identity, pronotepy.Identity);
      this.assertGreater(student.guardians.length, 0);
      for (const guardian of student.guardians) {
        this.assertIsInstance(guardian.identity, pronotepy.Identity);
      }
    }
  }
}