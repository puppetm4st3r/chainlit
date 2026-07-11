describe('Upload file', () => {
  it('should be able to receive and decode files', () => {
    cy.get('#ask-upload-dialog').should('exist');
    cy.get('[data-testid="ask-upload-instruction"]').should(
      'contain',
      'Please upload a text file to begin!'
    );
    cy.get('#ask-button-input').should('exist');

    // Upload a text file
    cy.fixture('state_of_the_union.txt', 'utf-8').as('txtFile');
    cy.get('#ask-button-input').selectFile('@txtFile', { force: true });
    cy.get('#ask-upload-submit').click();

    cy.get('.step')
      .eq(1)
      .should(
        'contain',
        'Text file state_of_the_union.txt uploaded, it contains'
      );

    cy.get('#ask-upload-dialog').should('exist');
    cy.get('[data-testid="ask-upload-instruction"]').should(
      'contain',
      'Please upload a python file to begin!'
    );
    cy.get('#ask-button-input').should('exist');

    // Expecting a python file, cpp file upload should be rejected
    cy.fixture('hello.cpp', 'utf-8').as('cppFile');
    cy.get('#ask-button-input').selectFile('@cppFile', { force: true });

    cy.get('.step').should('have.length', 3);

    // Upload a python file
    cy.fixture('hello.py', 'utf-8').as('pyFile');
    cy.get('#ask-button-input').selectFile('@pyFile', { force: true });
    cy.get('#ask-upload-submit').click();

    cy.get('.step')
      .should('have.length', 4)
      .eq(3)
      .should('contain', 'Python file hello.py uploaded, it contains');

    cy.get('#ask-upload-dialog').should('not.exist');
  });
});
