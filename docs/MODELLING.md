# Tags and properties: how to shape them

The owner's principle (2026-10-20), in short: **structure is extracted from free writing, not planned ahead of it.**

## The principle

- **Write the sentence first, with its links.** "Saw [[Dr. Chen]] at [[Northgate]] about the [[Tingling fingers]]." The
  words carry the context and read well in ten years; the links make it findable from both ends.
- **A linked page already has a quality.** Dr. Chen is a #Doctor, Northgate a #Hospital, Tingling fingers a #Symptom.
  The tag on the page says which property a link belongs in, so a sentence written freely already holds its
  structure. The plugin's job is to notice, not to ask.
- **The main bits live in both.** The sentence keeps them as words; the properties copy out the few worth listing or
  sorting by (Provider, Topic, Date). Not every detail needs a place in the schema: a node is not a database row.
- **A property exists for later.** Make one only for what you will list, sort or filter by. The test: would I ever
  want a list of these? If not, it stays in the words.
- **A tag exists only for its properties.** Make a new tag when its nodes need properties the others don't, always,
  or when you need to pull that kind out on its own. Otherwise it is a detail in the words, or a link.

The Illness Test Graph is shaped this way (`test/illness-test-graph.py`): thirteen tags, one to three properties
each, every record a sentence with its links.

## The three ways to connect things

- **A tag says what something is** (Consultation, Doctor, Report) and gives every node that carries it the same few properties.
- **A property records a fact you will want to list, sort or see from the other end** (which doctor, which day). A
  property that points to a page shows on that page too, as a two-way row.
- **A link in the words is a mention**, and when the page it points to has a tag, it is also the raw material of a
  property: the plugin proposes the property from the link.

## A child tag or a choice?

Make a child tag only when some nodes need a property the others do not. Until then a choice on the parent tells
them apart. The trigger is not "this is a different sort of thing" but "this sort of thing needs a property the
others do not".

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

Neither is built. The shape box carries two nudges: on a property page, "free text with few values may want a choice list"; and on a tag page (0.4.183), a field of the tag's own that is filled on half its records or fewer (once it has six or more) is named, as the sign that those records may want their own child tag. The Illness Test Graph holds a few records shaped the "wrong" way on purpose so these can be tried on them.
