title = "Prompt Studio Guide"
description = "Complete guide to creating reusable AI prompts with Prompt Studio"

# Prompt Studio Guide

Prompt Studio is a powerful tool for creating reusable prompts with customizable placeholders. Write your prompt once, define what information users need to provide, and publish it as a shareable product that others can use. This comprehensive guide will teach you everything you need to know to master Prompt Studio and create professional, reusable prompts.

## What is Prompt Studio?

Prompt Studio helps you create prompts that adapt based on user input. Instead of writing a new prompt every time, you create a template with placeholders. When someone uses your prompt, they fill in the placeholders, and the prompt adapts to their needs automatically.

**Example:**
Instead of writing "Write a blog post about dogs" every time, you create a prompt template:
```
Write a blog post about {{topic}} in a {{tone}} tone, approximately {{word_count}} words long.
```

Users can then fill in:
- `topic` = "dogs"
- `tone` = "friendly"
- `word_count` = "500"

And get a customized prompt automatically: "Write a blog post about dogs in a friendly tone, approximately 500 words long."

## Getting Started

### Opening Prompt Studio

1. Click on **"Prompt Studio"** in the sidebar (or navigate to `/prompt-studio`)
2. If you're not signed in, you'll be prompted to sign in
3. You'll see the Prompt Studio interface

**Note:** Prompt Studio works best on desktop screens (1100px wide or larger). If you're on a mobile device, you'll see a message prompting you to use a larger screen for the best experience.

### The Prompt Studio Interface

When you open Prompt Studio, you'll see a clean, focused interface designed for writing and editing prompts:

**The Editor** - This is the main text area where you write your prompt. It's the large area in the center with a dark background. The editor uses a special overlay system that highlights placeholders while keeping them editable. You can type normally, and placeholders appear as highlighted sections.

**The Toolbar** - At the top, you'll find several important buttons:
- **Placeholder** - Insert a new placeholder into your prompt
- **JSON** - Copy your prompt as JSON for use in other tools
- **Test Runner** - Test your prompt with sample values
- **Version** - Save a named version of your current prompt
- **Publish** - Share your prompt with others

**Placeholder Badges** - Below the editor, you'll see colorful badges showing all the placeholders you've defined. Each badge shows the placeholder name and lets you edit its question. Click a badge to configure that placeholder.

**Metrics Panel** - In the toolbar, you'll see real-time metrics:
- **Character Count** - Total characters in your prompt
- **Token Estimate** - Estimated tokens (roughly characters ÷ 4). This helps you stay within AI model limits.

## Creating Your First Prompt

### Step 1: Write Your Prompt

Start by writing your prompt in the editor. Write it as you normally would, but think about what parts should be customizable. Consider what varies each time you use the prompt.

**Example:**
```
You are a helpful assistant. Write a {{content_type}} about {{topic}}.
Make it {{tone}} and approximately {{length}} words long.
```

Think about:
- What parts change each time?
- What information do users need to provide?
- What should remain constant?

### Step 2: Add Placeholders

Placeholders are the customizable parts of your prompt. They're marked with double curly braces: `{{name}}`.

**To add a placeholder:**

**Method 1: Type directly**
1. In the editor, type `{{` followed by a name
2. Type `}}` to close it
3. The placeholder will automatically appear as a badge below

**Method 2: Use the Insert button**
1. Click the **"Placeholder"** button in the toolbar
2. Type a name for your placeholder
3. Click "Add" or press Enter
4. The placeholder is inserted at your cursor position

**Placeholder naming rules:**
- Names can contain letters, numbers, underscores, dots, and hyphens
- Names are case-sensitive (`{{Topic}}` is different from `{{topic}}`)
- Use clear, descriptive names
- Avoid spaces (use underscores instead: `{{word_count}}` not `{{word count}}`)

**Common placeholder names:**
- `{{topic}}` - The main subject
- `{{tone}}` - Writing style (formal, casual, friendly, etc.)
- `{{length}}` or `{{word_count}}` - Desired length
- `{{audience}}` - Target audience
- `{{format}}` - Output format (paragraph, list, etc.)
- `{{language}}` - Language for translation
- `{{style}}` - Writing style or format

### Step 3: Define Placeholder Questions

For each placeholder, you need to define a question that users will see when they use your prompt. This question appears as a form label above the input field.

**To edit a placeholder question:**

1. Click on the placeholder badge below the editor
2. Or double-click the placeholder in the editor text
3. A modal will appear where you can edit the question
4. Enter a clear question that explains what information is needed
5. Save your changes

**Example:**
- Placeholder: `{{topic}}`
- Question: "What topic should the content be about?"

**Tips for writing good questions:**
- Be clear and specific about what you need
- Explain what format you expect (e.g., "Enter a number", "Enter text", "Select from options")
- Provide examples when helpful (e.g., "e.g., dogs, cooking, technology")
- Keep questions concise but informative
- Use action words when appropriate ("Enter", "Select", "Choose")

**Better question examples:**
- ✅ "What topic should the blog post cover? (e.g., technology, cooking, travel)"
- ✅ "Enter the desired word count (number)"
- ✅ "Select the writing tone: formal, casual, or friendly"
- ❌ "Topic"
- ❌ "Enter something"

### Step 4: Preview Your Prompt

Use the preview feature to see how your prompt will look to users:

1. Click the **"Test Runner"** button in the toolbar
2. A modal will appear with input fields for each placeholder
3. Fill in the placeholder values with sample data
4. See how the final prompt looks with those values filled in
5. Test different combinations to ensure it works well

This helps you:
- Verify placeholders work correctly
- Check that the prompt makes sense with real values
- Test different combinations
- Identify any issues before publishing

### Step 5: Save a Version

As you work on your prompt, save versions to track your progress:

1. Click the **"Version"** button in the toolbar
2. Your current prompt is saved as a new version with a timestamp
3. You can view all versions in the version history panel
4. Restore any previous version if needed

**Why save versions:**
- Track changes over time
- Revert to a previous version if something goes wrong
- Compare different approaches
- Maintain a history of your prompt evolution
- Experiment freely knowing you can always go back

**Version management:**
- Versions are saved automatically with timestamps
- Each version includes the prompt text and all placeholder definitions
- You can restore any version to make it current
- Compare versions side-by-side to see what changed

### Step 6: Test Your Prompt

Before publishing, thoroughly test your prompt:

1. Click the **"Test Runner"** button
2. Fill in all placeholder values with realistic examples
3. Click "Run" to execute the prompt
4. Review the results to ensure it works as expected
5. Try different values to test various scenarios

**Testing tips:**
- Try edge cases (very short, very long, empty values if allowed)
- Test with realistic examples that real users might provide
- Verify the prompt makes sense with different inputs
- Test with various input lengths
- Try special characters if relevant
- Test with numbers, text, URLs, etc. depending on your placeholders

**What to check:**
- Do placeholders replace correctly?
- Does the final prompt make sense?
- Are there any formatting issues?
- Does it work with different input combinations?
- Are the results what you expected?

### Step 7: Publish Your Prompt

When you're ready to share your prompt:

1. Click the **"Publish"** button in the toolbar
2. Fill in all the publishing details:
   - **Name** - A clear, descriptive name that tells users what the prompt does
   - **Description** - Explain what your prompt does, when to use it, and what it's good for
   - **Thumbnail** - Add an image that represents your prompt (optional but highly recommended)
   - **Tags** - Add relevant tags to help people discover your prompt
   - **Visibility** - Choose Public, Unlisted, or Private
   - **Price** - Set if you want to charge for it (optional, requires premium account)
3. Review all details
4. Click "Publish"

Once published, your prompt gets a unique shareable link that others can use. If it's public, it will also appear in the Marketplace where people can discover it.

## Understanding Placeholders

### What Are Placeholders?

Placeholders are special markers in your prompt that get replaced with user input. They're written as `{{name}}` where `name` is what you call the placeholder. When a user fills in the placeholder, that value replaces the `{{name}}` in the final prompt.

**Example:**
```
Write a blog post about {{topic}}.
```

When a user fills in `topic` as "cooking", the prompt becomes:
```
Write a blog post about cooking.
```

### Creating Placeholders

**Method 1: Type them directly**
1. In the editor, position your cursor where you want the placeholder
2. Type `{{` followed by a name (e.g., `topic`)
3. Type `}}` to close it
4. The placeholder will appear as a badge below the editor
5. Click the badge to configure its question

**Method 2: Use the Insert button**
1. Position your cursor where you want the placeholder
2. Click the **"Placeholder"** button in the toolbar
3. Type a name for your placeholder
4. Click "Add" or press Enter
5. The placeholder is inserted and you can configure its question

**Placeholder syntax:**
- Must start with `{{` and end with `}}`
- Name goes between the braces
- No spaces in the name (use underscores: `{{word_count}}`)
- Case-sensitive (`{{Topic}}` ≠ `{{topic}}`)

### Editing Placeholders

To edit a placeholder's question or name:

1. Click on the placeholder badge below the editor
2. Or double-click the placeholder in the editor text
3. A modal will appear
4. Edit the question (the text users see)
5. You can also rename the placeholder if needed
6. Save your changes

**Editing tips:**
- Questions can be changed at any time
- Placeholder names can be changed (all instances update automatically)
- Make sure questions are clear and helpful
- Update questions based on user feedback

### Deleting Placeholders

To remove a placeholder:

1. Click on the placeholder badge below the editor
2. Click "Delete" in the modal
3. Or remove the `{{placeholder}}` text from your prompt
4. The placeholder will be removed from both the text and the badges

**Note:** If you delete a placeholder from the text, its badge will disappear automatically. If you delete it via the badge, it will be removed from the text as well.

### Placeholder Best Practices

**Use clear, descriptive names:**
- ✅ Good: `{{topic}}`, `{{word_count}}`, `{{tone}}`, `{{target_audience}}`
- ❌ Bad: `{{x}}`, `{{thing}}`, `{{data}}`, `{{stuff}}`

**Keep names consistent:**
- Use the same naming style throughout your prompt
- Use lowercase with underscores for multi-word names: `{{word_count}}`, `{{target_audience}}`
- Be consistent: don't mix `{{wordCount}}` and `{{word_count}}`

**Don't overuse placeholders:**
- Only make parts customizable that truly need to vary
- Too many placeholders can confuse users and make the prompt hard to use
- Aim for 3-7 placeholders for most prompts
- If you need more, consider if some could be combined

**Provide helpful context:**
- Write clear questions that explain what's needed
- Give examples when helpful
- Specify format requirements (e.g., "Enter a number", "Select from: A, B, or C")
- Explain why the information is needed if it helps

**Organize logically:**
- Place placeholders in a logical order
- Group related placeholders together
- Put the most important placeholders first

## Writing Effective Prompts

### Structure Your Prompt

A well-structured prompt is easier to understand and produces better results. Here's a recommended structure:

**Start with context:**
```
You are an expert writer specializing in {{topic}}.
```

**State the task clearly:**
```
Write a {{content_type}} that is {{tone}} and approximately {{length}} words.
```

**Provide guidelines and constraints:**
```
Make sure to:
- Use clear, engaging language
- Include relevant examples
- End with a strong conclusion
- Maintain a {{tone}} tone throughout
```

**Include placeholders strategically:**
```
Write about {{topic}} for an audience of {{audience}}.
```

**Add formatting instructions:**
```
Format the output as {{format}} with clear headings.
```

### Tips for Better Prompts

**Be specific:**
- ✅ "Write a 500-word blog post about {{topic}} in a friendly, conversational tone"
- ❌ "Write something about {{topic}}"

**Provide examples:**
- ✅ "Write a {{format}} (e.g., blog post, article, essay, or guide) about {{topic}}"
- ❌ "Write a {{format}} about {{topic}}"

**Set clear expectations:**
- ✅ "Write a detailed guide (at least 1000 words) about {{topic}}, including examples and practical tips"
- ❌ "Write about {{topic}}"

**Use placeholders for variable parts:**
- ✅ "Write in a {{tone}} tone (options: formal, casual, friendly, professional)"
- ❌ "Write in a tone"

**Give context:**
- ✅ "As an expert in {{topic}}, write a comprehensive guide..."
- ❌ "Write a guide..."

**Specify output format:**
- ✅ "Format your response as {{format}} with clear sections and bullet points"
- ❌ "Write about {{topic}}"

### Common Prompt Patterns

**Content Generation Pattern:**
```
You are an expert content writer.

Write a {{content_type}} about {{topic}}.

Requirements:
- Target audience: {{audience}}
- Tone: {{tone}}
- Length: Approximately {{length}} words
- Format: {{format}}

Make sure to include relevant examples and maintain a {{tone}} tone throughout.
```

**Analysis Pattern:**
```
You are an expert analyst.

Analyze the following {{document_type}}:
{{content}}

Provide a comprehensive analysis including:
- Key points and main themes
- Important insights
- Actionable recommendations
- Potential concerns or risks

Format your response as {{format}}.
```

**Transformation Pattern:**
```
You are a professional editor.

Rewrite the following text in a {{tone}} tone:
{{original_text}}

Requirements:
- Maintain the core message
- Adjust tone to be {{tone}}
- Target length: {{length}} words
- Target audience: {{audience}}
- Format: {{format}}
```

**Translation Pattern:**
```
You are a professional translator.

Translate the following text from {{source_language}} to {{target_language}}:
{{text}}

Requirements:
- Maintain the original meaning and tone
- Use natural, fluent {{target_language}}
- Preserve any formatting or structure
- Ensure cultural appropriateness
```

**Question Answering Pattern:**
```
You are a helpful assistant with expertise in {{topic}}.

Answer the following question about {{topic}}:
{{question}}

Provide:
- A clear, direct answer
- Relevant context or background
- Examples if helpful
- Additional resources if applicable

Format: {{format}}
```

## Advanced Features

### Version History

Prompt Studio automatically saves your work as you type, and you can save named versions:

1. Click the **"Version"** button in the toolbar
2. Your current prompt (including all placeholders and their questions) is saved as a new version
3. View all versions in the version history panel (accessible from the toolbar)
4. Restore any previous version to make it current
5. Compare versions to see what changed

**Use cases:**
- Save milestones as you develop your prompt
- Try different approaches and compare results
- Revert if something goes wrong
- Maintain a history of improvements
- Experiment freely knowing you can always go back

**Version management tips:**
- Save versions before making major changes
- Use descriptive names or notes if the system supports it
- Regularly review old versions to learn from past iterations
- Don't be afraid to experiment - you can always restore

### JSON Export

Export your prompt as JSON for use in other tools or sharing with developers:

1. Click the **"JSON"** button in the toolbar
2. A modal will show the JSON representation
3. Copy the JSON to your clipboard
4. Use it in other tools, APIs, or share it with developers

**The JSON includes:**
- Your prompt text with placeholders
- All placeholders and their questions
- Metadata (name, description if set)
- Version information

**Use cases:**
- Integrate with other tools
- Share with developers for API integration
- Backup your prompts
- Import into other systems
- Version control

### Token Estimation

Prompt Studio shows an estimated token count for your prompt. Tokens are how AI models measure text length.

**Understanding tokens:**
- Roughly 1 token = 0.75 words (or 4 characters)
- Longer prompts use more tokens
- Different AI models have different token limits
- User input adds to the total token count

**Common token limits:**
- GPT-4o: 128,000 tokens
- GPT-4 Turbo: 128,000 tokens
- GPT-3.5 Turbo: 16,385 tokens
- GPT-4o mini: 128,000 tokens

**Tips:**
- Keep prompts concise but complete
- Monitor token count to stay within model limits
- Remember that user input adds to the total
- Leave room for the AI's response
- Consider the total context window (prompt + response)

**Optimizing token usage:**
- Remove unnecessary words
- Use abbreviations where appropriate
- Be concise but clear
- Remove redundant instructions

### Character Count

The editor shows real-time character count, which helps you:

- See how long your prompt is
- Stay within character limits if needed
- Track changes as you edit
- Ensure consistency across versions

**Character count includes:**
- All text in your prompt
- Placeholder markers (`{{` and `}}`)
- Whitespace and formatting

## The Editor Interface

### Writing in the Editor

The Prompt Studio editor is designed for comfortable writing:

- **Large text area** - Plenty of space to write
- **Clean interface** - Minimal distractions
- **Placeholder highlighting** - Placeholders are visually highlighted
- **Auto-save** - Your work is saved automatically
- **Smooth scrolling** - Easy navigation through long prompts

### Placeholder Visualization

Placeholders are visually distinct in the editor:
- They appear with a special highlight/background
- You can click them to edit
- They're protected from accidental editing (you can't place your cursor inside them)
- They're clearly marked so you know what's customizable

### Editing Features

- **Normal text editing** - Type, delete, copy, paste as usual
- **Placeholder protection** - Placeholders can't be accidentally edited
- **Click to edit** - Click a placeholder to configure it
- **Auto-complete** - The editor helps with placeholder syntax

## Testing Your Prompt

### Using the Test Runner

The Test Runner lets you test your prompt before publishing:

1. Click **"Test Runner"** in the toolbar
2. A modal appears with input fields for each placeholder
3. Fill in all placeholder values with sample data
4. Click "Run" to execute the prompt
5. Review the results
6. Try different values to test various scenarios

**What the Test Runner shows:**
- Input form with all your placeholders
- The final prompt with values filled in
- The AI's response (if connected to an AI service)
- Any errors or issues

### Testing Strategies

**Test with realistic values:**
- Use examples that real users might provide
- Test different combinations of values
- Try various input lengths
- Test with different data types (text, numbers, etc.)

**Test edge cases:**
- Very short inputs (1-2 words)
- Very long inputs (paragraphs or pages)
- Empty values (if your prompt allows it)
- Special characters and punctuation
- Numbers, URLs, email addresses if relevant
- Unicode and international characters

**Verify the output:**
- Make sure the final prompt makes sense
- Check that placeholders are replaced correctly
- Ensure the prompt works as intended
- Verify formatting is correct
- Check that all placeholders are filled

**Test different scenarios:**
- Best case scenarios
- Worst case scenarios
- Typical use cases
- Unusual but valid inputs
- Boundary conditions

### Common Issues

**Placeholders not replacing:**
- Check spelling - placeholders are case-sensitive
- Make sure you used `{{` and `}}` correctly (double curly braces)
- Verify the placeholder name matches exactly
- Check for typos in placeholder names

**Prompt doesn't work as expected:**
- Review your prompt text for clarity
- Test with different values
- Make sure instructions are clear and specific
- Check that placeholders are in the right places
- Verify the prompt structure makes sense

**Test runner not working:**
- Verify all placeholders have questions defined
- Check that your prompt text is valid
- Make sure you're connected to the internet
- Try refreshing the page
- Check for JavaScript errors in the browser console

## Publishing Your Prompt

### Before Publishing

**Make sure your prompt:**
- Works correctly with various inputs
- Has clear, helpful placeholder questions
- Is well-written and easy to understand
- Has been tested thoroughly
- Doesn't contain sensitive information
- Follows best practices
- Has appropriate formatting

**Checklist:**
- ✅ All placeholders have clear questions
- ✅ Prompt has been tested with multiple inputs
- ✅ Description explains what the prompt does
- ✅ Name is clear and descriptive
- ✅ No typos or errors
- ✅ Formatting is correct

### Publishing Options

**Name:**
- Choose a clear, descriptive name
- Make it searchable and understandable
- Avoid vague names like "My Prompt" or "Test"
- Use title case: "Blog Post Writer" not "blog post writer"
- Be specific: "Technical Blog Post Writer" is better than "Writer"

**Description:**
- Explain what your prompt does
- Describe when to use it
- Mention any requirements or prerequisites
- Include examples if helpful
- List the placeholders and what they do
- Explain the expected output

**Thumbnail:**
- Add a relevant, high-quality image
- Makes your prompt more discoverable
- Use clear, professional images
- Represent what the prompt does visually
- Use consistent styling if creating multiple prompts

**Tags:**
- Add relevant tags to help discovery
- Use common, descriptive tags
- Include category tags (e.g., "writing", "analysis", "translation")
- Add use case tags (e.g., "blog-posts", "emails", "summaries")
- Don't over-tag (5-10 tags is usually enough)

**Visibility:**
- **Public** - Anyone can find and use it in the marketplace
- **Unlisted** - Only people with the link can use it
- **Private** - Only you can use it

**Pricing:**
- **Free** - Anyone can use it without payment
- **Paid** - Set a price per use (requires premium account)

### After Publishing

Once published, your prompt:
- Gets a unique shareable link
- Appears in the Marketplace (if public)
- Can be used by others who fill in placeholders
- Can be updated by republishing
- Tracks usage statistics
- Can receive feedback and ratings

**Updating your prompt:**
- Make changes in Prompt Studio
- Click "Publish" again
- Your updated version replaces the old one
- The link stays the same
- Users get the latest version

## Best Practices

### Writing Prompts

**Be clear and specific:**
- Tell the AI exactly what you want
- Provide context and background
- Use examples when helpful
- Specify format requirements
- Set clear expectations

**Structure well:**
- Organize your prompt logically
- Use clear sections
- Make it easy to read
- Use formatting (lists, headings) when helpful
- Group related instructions together

**Test thoroughly:**
- Try different inputs
- Test edge cases
- Verify it works as expected
- Fix issues before publishing
- Get feedback from others

**Optimize for results:**
- Be specific about desired output
- Provide examples of good output
- Set constraints and boundaries
- Guide the AI's thinking process
- Specify format and structure

### Using Placeholders

**Choose good names:**
- Use descriptive, clear names
- Be consistent with naming style
- Avoid abbreviations unless obvious
- Use lowercase with underscores for multi-word names
- Make names self-documenting

**Write helpful questions:**
- Explain what information is needed
- Provide examples or format hints
- Keep questions concise but informative
- Use action words ("Enter", "Select", "Choose")
- Specify format requirements

**Don't overuse:**
- Only make parts customizable that need to vary
- Too many placeholders can be overwhelming
- Aim for 3-7 placeholders for most prompts
- Consider if some placeholders could be combined
- Balance flexibility with usability

**Organize logically:**
- Place placeholders in a logical order
- Group related placeholders together
- Put most important placeholders first
- Make the flow intuitive

### Publishing

**Write good descriptions:**
- Explain what your prompt does
- Describe use cases and when to use it
- Mention any requirements
- Include examples
- List the placeholders
- Explain the expected output

**Use appropriate tags:**
- Help people find your prompt
- Use relevant, common tags
- Include category and use case tags
- Don't over-tag
- Research what tags others use

**Set appropriate visibility:**
- Public for sharing widely
- Unlisted for sharing with specific people
- Private for personal use or testing

**Create good thumbnails:**
- Use clear, relevant images
- Make them professional
- Represent what the prompt does
- Use consistent styling

## Troubleshooting

### Common Issues

**Placeholders not working:**
- Check spelling and case sensitivity (`{{Topic}}` ≠ `{{topic}}`)
- Verify you used `{{` and `}}` correctly (double curly braces)
- Make sure placeholder names match exactly
- Check for typos
- Ensure placeholders aren't nested incorrectly

**Prompt not saving:**
- Check your internet connection
- Try refreshing the page
- Make sure you're signed in
- Check browser console for errors
- Try saving again

**Test runner not working:**
- Verify all placeholders have questions defined
- Check that your prompt text is valid
- Make sure you're connected to the internet
- Try refreshing the page
- Check browser console for errors

**Publishing fails:**
- Make sure all required fields are filled
- Check that your prompt has been tested
- Verify you have permission to publish
- Check for any validation errors
- Ensure your account has publishing privileges

**Placeholders not appearing:**
- Make sure you used the correct syntax: `{{name}}`
- Check that the name doesn't contain invalid characters
- Verify the placeholder is in the text, not just in your head
- Try refreshing the page

**Version history not working:**
- Make sure you've saved at least one version
- Check that you're signed in
- Try refreshing the page
- Verify your browser supports the feature

### Getting Help

If you're stuck:
1. Review this comprehensive documentation
2. Check the [Help Center](/help) for general help
3. Browse example prompts in the marketplace for inspiration
4. Contact support at support@edgaze.ai

## Advanced Techniques

### Nested Placeholders

While you can't nest placeholders directly, you can create complex prompts by using placeholders in logical sequences:

```
Write a {{content_type}} about {{topic}}.

The {{content_type}} should:
- Be written in a {{tone}} tone
- Target {{audience}} as the audience
- Be approximately {{length}} words long
- Include {{number_of_examples}} examples
```

### Conditional Logic in Prompts

You can create prompts that adapt based on placeholder values by including conditional instructions:

```
Write a {{content_type}} about {{topic}}.

{% if tone == "formal" %}
Use professional language and avoid contractions.
{% else %}
Use conversational language that feels natural.
{% endif %}
```

Note: Advanced conditional logic may require specific prompt engineering techniques.

### Dynamic Instructions

Use placeholders to make instructions dynamic:

```
Write a {{content_type}} about {{topic}}.

Requirements:
- Length: {{length}} words
- Tone: {{tone}}
- Format: {{format}}
- Include {{number_of_sections}} main sections
- Target audience: {{audience}}
```

### Multi-Step Prompts

Create prompts that guide the AI through multiple steps:

```
You are an expert {{expertise_area}}.

Step 1: Analyze {{input}}
Step 2: Identify key {{focus_areas}}
Step 3: Provide {{output_type}} based on your analysis

Format the final output as {{format}}.
```

## Next Steps

Now that you understand Prompt Studio:
- [Learn about Workflow Studio](/docs/builder/workflow-studio) - Build complex multi-step workflows
- [Browse the Marketplace](/marketplace) - See what others have created and get inspiration
- [Visit your Library](/library) - Manage your prompts and workflows

Happy creating!
