# Tags and fields: how to shape them

The principle behind the tag tree (and the shape box on tag and property pages): how to decide what is a tag, a child tag, a field or a link, given that some of these are cheap to change later and some are not. Agreed with the owner on 2026-10-19 in the "Illness test graph" thread, and used to build that graph.

## The three ways to connect things

- **A tag says what something is** (Appointment, Doctor, Report). It acts like a class: it gives every record that carries it the same set of fields.
- **A field records a fact you will want to list, sort or see from the other end** (which doctor, which day, which report). A field that points to a page also shows on that page, in the two-way rows.
- **A link in the words is a mention.** It shows under Linked references and nowhere else.

The test for each connection: would anyone ever want a list of these? If yes, it is a field.

## A child tag or a "kind" field?

Make a child tag only when some records need a fact the others do not have.

1. Start with one tag, Appointment. Every visit has a date, a doctor and a hospital; a "kind" choice (Scan, Blood test, Consultation) tells them apart. One tag is enough while every visit has the same fields.
2. The first CT scan needs "contrast: yes/no". That fact only makes sense for scans.
3. That is the moment to make Scan a child tag of Appointment. It gets "contrast" and keeps date, doctor and hospital from Appointment, and the other visits are not cluttered with a field they never use. Scan records still count as Appointments.

So the trigger is not "this is a different sort of thing" but "this sort of thing needs a field the others do not". Until then a "kind" field with a fixed list does the same job and is easier to change. A sub-kind is never free text: "CT", "CT scan" and "ct" sort as three things.

## What is cheap and what is expensive to change later

Cheap:
- renaming a tag or a field (the name is a label; every record keeps its link);
- adding a field to a tag;
- adding a choice to a fixed list;
- adding a child tag, or moving a tag under another parent (the tag tree does this).

Expensive (each record redone by hand in Logseq):
- turning a "kind" value into a child tag;
- turning free text into links to pages;
- changing what type of value a field holds once records use it;
- merging two tags that overlapped.

Hence: start broad; when unsure whether something should point to a page, make it point to a page; make a child tag only when its first own field appears.

## Where the plugin could help (proposed, not decided)

The safe way of working leads straight into one expensive change, so the tag tree is the place to make it cheap:

- **Make a choice its own tag**: "Make Scan its own tag" retags every Appointment whose kind is Scan as Scan (a child of Appointment) in one step, keeps their fields, clears the kind, and can be undone.
- **Turn a text field into page links**: one page per distinct value, each record's text replaced by the link.

Neither is built. The shape box's hint "free text with few values may want a choice list" is the existing nudge in this direction. The Illness Test Graph holds a few records shaped the "wrong" way on purpose so these can be tried on them.
