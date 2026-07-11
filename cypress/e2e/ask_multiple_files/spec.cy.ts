describe('Upload multiple files', () => {
  it('should be able to receive two files', () => {
    cy.get('#ask-upload-dialog').should('exist');
    cy.get('#ask-button-input').should('exist');

    cy.fixture('state_of_the_union.txt', 'utf-8').as('txtFile');
    cy.fixture('hello.py', 'utf-8').as('pyFile');

    cy.get('#ask-button-input').selectFile(['@txtFile', '@pyFile'], {
      force: true
    });
    cy.get('#ask-upload-submit').click();

    cy.get('.step')
      .eq(1)
      .should('contain', '2 files uploaded: state_of_the_union.txt,hello.py');

    cy.get('#ask-upload-dialog').should('not.exist');
  });
});
