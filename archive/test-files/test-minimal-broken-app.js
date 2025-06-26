// This is a broken JavaScript app for testing claude-loop
console.log('Starting broken app...');

// Bug 1: Undefined variable
const result = someUndefinedVariable + 5;

// Bug 2: Syntax error in function
function brokenFunction() {
    if (true {
        console.log('Missing closing parenthesis');
    }
}

// Bug 3: Wrong method call
const obj = {
    name: 'test'
};
obj.nonExistentMethod();

// Bug 4: Infinite loop (commented out to prevent actual infinite loop)
// while (true) {
//     console.log('This would loop forever');
// }

// Bug 5: Type error
const str = 'hello';
str.nonExistentProperty.value = 'error';

console.log('This line will never be reached due to errors above');